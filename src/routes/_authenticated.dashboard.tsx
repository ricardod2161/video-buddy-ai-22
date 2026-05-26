import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, LogOut, Upload, Sparkles, Clock, XCircle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { triggerProcessing } from "@/lib/processing.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Painel — Clip Forge" }] }),
});

type VideoRow = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  original_url: string;
  output_url: string | null;
  error_msg: string | null;
  created_at: string;
};

function Dashboard() {
  const qc = useQueryClient();
  const trigger = useServerFn(triggerProcessing);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
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

  // Realtime: refetch quando o status mudar.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`videos:${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "videos", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["videos"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  async function handleUpload(file: File) {
    if (!userId) return;
    if ((credits.data ?? 0) <= 0) {
      toast.error("Sem créditos disponíveis.");
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error("Arquivo maior que 500MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;

      // 1) Upload
      const { error: upErr } = await supabase.storage
        .from("videos-input").upload(path, file, { contentType: file.type || "video/mp4" });
      if (upErr) throw upErr;

      // 2) Consumir crédito
      const { error: credErr } = await supabase.rpc("consume_credit");
      if (credErr) {
        await supabase.storage.from("videos-input").remove([path]);
        throw new Error(credErr.message === "no_credits" ? "Sem créditos." : credErr.message);
      }

      // 3) Inserir vídeo
      const { data: inserted, error: insErr } = await supabase
        .from("videos").insert({ user_id: userId, original_url: path }).select("id").single();
      if (insErr) throw insErr;

      // 4) Disparar processamento
      try {
        const res = await trigger({ data: { jobId: inserted.id } });
        if (!res.queued && res.reason === "backend_not_configured") {
          toast.message("Vídeo enviado", {
            description: "Backend de processamento ainda não configurado — o vídeo ficará em pending.",
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
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <main className="grain min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </div>
            <span className="font-mono text-sm tracking-wider">CLIP/FORGE</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Créditos</p>
              <p className="text-lg font-semibold">{credits.data ?? "—"}</p>
            </div>
            <div className="hidden text-sm text-muted-foreground sm:block">{email}</div>
            <button onClick={signOut} className="rounded-md border border-border p-2 hover:bg-secondary" title="Sair">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur md:col-span-2">
            <h2 className="text-lg font-semibold">Enviar vídeo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              MP4 ou MOV até 500MB. Custa 1 crédito por upload.
            </p>

            <label
              className={`mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-10 text-center transition-colors hover:border-primary/60 hover:bg-secondary/40 ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <input
                ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              />
              {uploading ? (
                <Loader2 className="size-7 animate-spin text-primary" />
              ) : (
                <Upload className="size-7 text-primary" />
              )}
              <p className="mt-3 text-sm font-medium">
                {uploading ? "Enviando…" : "Clique ou arraste seu vídeo aqui"}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                mp4 · mov · até 500mb
              </p>
            </label>
          </div>

          <div className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Saldo</p>
            <p className="mt-2 text-5xl font-bold text-primary">{credits.data ?? "—"}</p>
            <p className="mt-1 text-sm text-muted-foreground">créditos disponíveis</p>
            <div className="mt-6 rounded-md border border-border bg-background/40 p-3 text-xs text-muted-foreground">
              Cada upload consome 1 crédito. Novos usuários ganham 10.
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Seus vídeos</h2>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              atualização em tempo real
            </p>
          </div>
          {videos.isLoading ? (
            <div className="rounded-xl border border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
              Carregando…
            </div>
          ) : (videos.data?.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Nenhum vídeo enviado ainda.
            </div>
          ) : (
            <ul className="space-y-2">
              {videos.data!.map((v) => <VideoItem key={v.id} v={v} />)}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function VideoItem({ v }: { v: VideoRow }) {
  const name = useMemo(() => v.original_url.split("/").pop() ?? v.id, [v]);
  const date = new Date(v.created_at).toLocaleString("pt-BR");

  const statusUI = {
    pending: { icon: Clock, label: "Pendente", cls: "text-muted-foreground" },
    processing: { icon: Loader2, label: "Processando", cls: "text-warning animate-spin" },
    completed: { icon: CheckCircle2, label: "Pronto", cls: "text-success" },
    failed: { icon: XCircle, label: "Falhou", cls: "text-destructive" },
  }[v.status];

  const StatusIcon = statusUI.icon;

  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/40 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm">{name}</p>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{date}</p>
        {v.error_msg && (
          <p className="mt-1 truncate text-xs text-destructive">{v.error_msg}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 text-xs ${statusUI.cls.replace("animate-spin","")}`}>
          <StatusIcon className={`size-4 ${v.status === "processing" ? "animate-spin" : ""}`} />
          <span>{statusUI.label}</span>
        </div>
        {v.status === "completed" && v.output_url && (
          <a
            href={v.output_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            <Download className="size-3.5" /> Baixar
          </a>
        )}
      </div>
    </li>
  );
}
