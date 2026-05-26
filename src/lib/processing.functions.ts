// Server function that triggers external processing pipeline.
// Substitui a Edge Function do diagrama original — mesmo runtime do app.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TriggerInput = z.object({
  jobId: z.string().uuid(),
});

export const triggerProcessing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TriggerInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // 1) Confirma ownership do job (defense-in-depth além do RLS).
    const { data: video, error: vidErr } = await supabaseAdmin
      .from("videos")
      .select("id, user_id, original_url, status")
      .eq("id", data.jobId)
      .maybeSingle();

    if (vidErr) throw new Error(vidErr.message);
    if (!video || video.user_id !== userId) {
      throw new Error("not_found");
    }
    if (video.status !== "pending") {
      return { queued: false, reason: "already_processing" as const };
    }

    const BACKEND_URL = process.env.BACKEND_URL;
    const SHARED_SECRET = process.env.SHARED_SECRET;

    if (!BACKEND_URL || !SHARED_SECRET) {
      // Backend ainda não configurado — deixa em pending sem erro.
      console.warn("[triggerProcessing] BACKEND_URL/SHARED_SECRET ausentes; job permanece pending");
      return { queued: false, reason: "backend_not_configured" as const };
    }

    // 2) Gera signed URL temporária para o backend baixar o arquivo.
    const { data: signed, error: signErr } = await supabaseAdmin
      .storage.from("videos-input")
      .createSignedUrl(video.original_url, 60 * 60);
    if (signErr || !signed) throw new Error(signErr?.message ?? "signed_url_failed");

    // 3) Dispara o backend (não bloqueia para sempre; timeout curto de conexão).
    try {
      const res = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-secret": SHARED_SECRET,
        },
        body: JSON.stringify({
          job_id: video.id,
          file_url: signed.signedUrl,
          user_id: userId,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`backend_${res.status}:${text.slice(0, 200)}`);
      }
      return { queued: true as const };
    } catch (err) {
      // Marca como falha para o usuário ver no painel.
      await supabaseAdmin
        .from("videos")
        .update({
          status: "failed",
          error_msg: err instanceof Error ? err.message : String(err),
        })
        .eq("id", video.id);
      throw err;
    }
  });
