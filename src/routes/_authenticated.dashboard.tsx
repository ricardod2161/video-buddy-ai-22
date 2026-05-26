import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CreditsBadge } from "@/components/dashboard/credits-badge";
import { UserMenu } from "@/components/dashboard/user-menu";
import { UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { VideosTable, type VideoRow } from "@/components/dashboard/videos-table";
import { supabase } from "@/integrations/supabase/client";
import { triggerProcessing } from "@/lib/processing.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Painel — Clip Forge" }] }),
});

function Dashboard() {
  const qc = useQueryClient();
  const trigger = useServerFn(triggerProcessing);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? "");
    });
  }, []);

  const credits = useQuery({
    queryKey: ["credits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_credits").select("amount").maybeSingle();
      if (error) throw error;
      return data?.amount ?? 0;
    },
  });

  const videos = useQuery({
    queryKey: ["videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id,status,original_url,output_url,error_msg,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VideoRow[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`videos:${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "videos", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["videos"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  async function handleUpload(file: File) {
    if (!userId) throw new Error("Não autenticado");
    if ((credits.data ?? 0) <= 0) {
      toast.error("Sem créditos disponíveis.");
      throw new Error("no_credits");
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error("Arquivo maior que 500MB.");
      throw new Error("too_large");
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    try {
      const { error: upErr } = await supabase.storage
        .from("videos-input").upload(path, file, { contentType: file.type || "video/mp4" });
      if (upErr) throw upErr;

      const { error: credErr } = await supabase.rpc("consume_credit");
      if (credErr) {
        await supabase.storage.from("videos-input").remove([path]);
        throw new Error(credErr.message === "no_credits" ? "Sem créditos." : credErr.message);
      }

      const { data: inserted, error: insErr } = await supabase
        .from("videos").insert({ user_id: userId, original_url: path }).select("id").single();
      if (insErr) throw insErr;

      try {
        const res = await trigger({ data: { jobId: inserted.id } });
        if (!res.queued && res.reason === "backend_not_configured") {
          toast.message("Vídeo enviado", {
            description: "Backend de processamento ainda não configurado — ficará em pending.",
          });
        } else {
          toast.success("Vídeo enfileirado para processamento.");
        }
      } catch (err) {
        toast.warning("Upload ok, mas o disparo do processamento falhou.", {
          description: err instanceof Error ? err.message : String(err),
        });
      }

      qc.invalidateQueries({ queryKey: ["credits"] });
      qc.invalidateQueries({ queryKey: ["videos"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no upload");
      throw err;
    }
  }

  return (
    <SidebarProvider>
      <div className="grain flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <h1 className="text-base font-semibold">Vídeos</h1>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  envie · processe · baixe
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CreditsBadge credits={credits.data} loading={credits.isLoading} />
              <UserMenu email={email} />
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
            <section>
              <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Enviar vídeo</h2>
              <UploadDropzone
                onFile={async (file) => { await handleUpload(file); }}
                disabled={!userId || (credits.data ?? 0) <= 0}
              />
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground">Seus vídeos</h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  tempo real
                </p>
              </div>
              <VideosTable videos={videos.data ?? []} loading={videos.isLoading} />
            </section>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
