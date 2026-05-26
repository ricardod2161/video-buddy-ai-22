import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHmac } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function detectSourceType(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("vimeo.com")) return "vimeo";
  if (u.includes("twitch.tv")) return "twitch";
  if (u.includes("instagram.com")) return "instagram";
  return "url";
}

async function notifyWorker(payload: Record<string, unknown>) {
  const BACKEND_URL = process.env.BACKEND_URL;
  const SHARED_SECRET = process.env.WORKER_SECRET;
  if (!BACKEND_URL || !SHARED_SECRET) {
    console.warn("[worker] BACKEND_URL/WORKER_SECRET ausente — job fica em queue");
    return { dispatched: false as const, reason: "backend_not_configured" as const };
  }
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", SHARED_SECRET).update(body).digest("hex");
  try {
    const res = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-signature": sig },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`worker_${res.status}:${text.slice(0, 200)}`);
    }
    return { dispatched: true as const };
  } catch (err) {
    return { dispatched: false as const, reason: "worker_error" as const, error: err instanceof Error ? err.message : String(err) };
  }
}

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ url: z.string().url().max(2048) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // 1) consome 1 crédito (RLS-safe, via RPC do próprio usuário)
    const { error: credErr } = await supabase.rpc("consume_credit");
    if (credErr) {
      throw new Error(credErr.message === "no_credits" ? "Sem créditos." : credErr.message);
    }

    // 2) cria o projeto
    const { data: project, error: insErr } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        source_url: data.url,
        source_type: detectSourceType(data.url),
        status: "queued",
        progress: 0,
      })
      .select("id")
      .single();
    if (insErr || !project) throw new Error(insErr?.message ?? "insert_failed");

    // 3) dispara worker
    const callbackBase = process.env.PUBLIC_APP_URL ?? "";
    const dispatch = await notifyWorker({
      project_id: project.id,
      user_id: userId,
      source_url: data.url,
      callback_url: callbackBase ? `${callbackBase.replace(/\/$/, "")}/api/public/worker-callback` : null,
    });

    return { id: project.id, dispatch };
  });

export const requestRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      clipId: z.string().uuid(),
      aspectRatio: z.enum(["9:16", "1:1", "16:9", "4:5"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // garante ownership do clip + pega project_id
    const { data: clip, error: clipErr } = await supabase
      .from("clips").select("id, project_id, user_id").eq("id", data.clipId).maybeSingle();
    if (clipErr) throw new Error(clipErr.message);
    if (!clip || clip.user_id !== userId) throw new Error("not_found");

    // upsert render row
    const { data: render, error: upErr } = await supabaseAdmin
      .from("clip_renders")
      .upsert(
        {
          clip_id: data.clipId,
          user_id: userId,
          aspect_ratio: data.aspectRatio,
          status: "queued",
          output_url: null,
          error_msg: null,
        },
        { onConflict: "clip_id,aspect_ratio" },
      )
      .select("id")
      .single();
    if (upErr || !render) throw new Error(upErr?.message ?? "render_failed");

    const callbackBase = process.env.PUBLIC_APP_URL ?? "";
    const dispatch = await notifyWorker({
      action: "render",
      project_id: clip.project_id,
      clip_id: data.clipId,
      render_id: render.id,
      user_id: userId,
      aspect_ratio: data.aspectRatio,
      callback_url: callbackBase ? `${callbackBase.replace(/\/$/, "")}/api/public/worker-callback` : null,
    });

    return { id: render.id, dispatch };
  });
