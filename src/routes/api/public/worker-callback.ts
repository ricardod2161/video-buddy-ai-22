import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Payload = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("project_progress"),
    project_id: z.string().uuid(),
    status: z.enum(["queued", "downloading", "transcribing", "analyzing", "rendering", "done", "failed"]),
    progress: z.number().min(0).max(100).optional(),
    title: z.string().max(500).optional(),
    duration_sec: z.number().int().min(0).optional(),
    error_msg: z.string().max(2000).optional(),
  }),
  z.object({
    event: z.literal("clips_ready"),
    project_id: z.string().uuid(),
    user_id: z.string().uuid(),
    clips: z.array(z.object({
      title: z.string().min(1).max(300),
      hashtags: z.array(z.string().max(50)).max(20).default([]),
      score: z.number().int().min(0).max(100),
      start_sec: z.number().min(0),
      end_sec: z.number().min(0),
      transcript: z.string().max(10000).nullable().optional(),
      virality_reason: z.string().max(1000).nullable().optional(),
    })).min(1).max(30),
  }),
  z.object({
    event: z.literal("render_done"),
    render_id: z.string().uuid(),
    output_url: z.string().url().max(2048),
  }),
  z.object({
    event: z.literal("render_failed"),
    render_id: z.string().uuid(),
    error_msg: z.string().max(2000),
  }),
]);

export const Route = createFileRoute("/api/public/worker-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.WORKER_SECRET;
        if (!secret) return new Response("not_configured", { status: 500 });

        const sigHeader = request.headers.get("x-signature");
        const body = await request.text();
        if (!sigHeader) return new Response("missing_signature", { status: 401 });

        const expected = createHmac("sha256", secret).update(body).digest("hex");
        const a = Buffer.from(sigHeader, "utf8");
        const b = Buffer.from(expected, "utf8");
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("bad_signature", { status: 401 });
        }

        let parsed: z.infer<typeof Payload>;
        try { parsed = Payload.parse(JSON.parse(body)); }
        catch (err) {
          return new Response(err instanceof Error ? err.message : "invalid", { status: 400 });
        }

        if (parsed.event === "project_progress") {
          const update: Record<string, unknown> = { status: parsed.status };
          if (parsed.progress !== undefined) update.progress = parsed.progress;
          if (parsed.title) update.title = parsed.title;
          if (parsed.duration_sec !== undefined) update.duration_sec = parsed.duration_sec;
          if (parsed.error_msg) update.error_msg = parsed.error_msg;
          const { error } = await supabaseAdmin
            .from("projects").update(update).eq("id", parsed.project_id);
          if (error) return new Response(error.message, { status: 500 });
        } else if (parsed.event === "clips_ready") {
          const rows = parsed.clips.map((c) => ({
            project_id: parsed.project_id,
            user_id: parsed.user_id,
            title: c.title,
            hashtags: c.hashtags,
            score: c.score,
            start_sec: c.start_sec,
            end_sec: c.end_sec,
            transcript: c.transcript ?? null,
            virality_reason: c.virality_reason ?? null,
          }));
          const { error } = await supabaseAdmin.from("clips").insert(rows);
          if (error) return new Response(error.message, { status: 500 });
        } else if (parsed.event === "render_done") {
          const { error } = await supabaseAdmin
            .from("clip_renders")
            .update({ status: "done", output_url: parsed.output_url, error_msg: null })
            .eq("id", parsed.render_id);
          if (error) return new Response(error.message, { status: 500 });
        } else {
          const { error } = await supabaseAdmin
            .from("clip_renders")
            .update({ status: "failed", error_msg: parsed.error_msg })
            .eq("id", parsed.render_id);
          if (error) return new Response(error.message, { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
