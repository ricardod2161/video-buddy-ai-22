import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CreditsBadge } from "@/components/dashboard/credits-badge";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ProjectStatusBadge, ProjectProgress, type ProjectStatus } from "@/components/projects/project-status";
import { ClipCard, type ClipCardData, type AspectRatio, type ClipRender } from "@/components/projects/clip-card";
import { supabase } from "@/integrations/supabase/client";
import { requestRender } from "@/lib/projects.functions";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectDetail,
  head: () => ({ meta: [{ title: "Projeto — Clip Forge" }] }),
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const render = useServerFn(requestRender);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const credits = useQuery({
    queryKey: ["credits"],
    queryFn: async () => {
      const { data } = await supabase.from("user_credits").select("amount").maybeSingle();
      return data?.amount ?? 0;
    },
  });

  const project = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,source_url,source_type,title,duration_sec,status,progress,error_msg,created_at")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const clips = useQuery({
    queryKey: ["clips", id],
    queryFn: async () => {
      const { data: clipRows, error } = await supabase
        .from("clips")
        .select("id,title,hashtags,score,start_sec,end_sec,transcript,virality_reason")
        .eq("project_id", id)
        .order("score", { ascending: false });
      if (error) throw error;
      const clipIds = (clipRows ?? []).map((c) => c.id);
      if (clipIds.length === 0) return [] as ClipCardData[];
      const { data: renderRows } = await supabase
        .from("clip_renders")
        .select("id,clip_id,aspect_ratio,status,output_url")
        .in("clip_id", clipIds);
      const grouped = new Map<string, ClipRender[]>();
      (renderRows ?? []).forEach((r) => {
        const arr = grouped.get(r.clip_id) ?? [];
        arr.push({
          id: r.id,
          aspect_ratio: r.aspect_ratio as AspectRatio,
          status: r.status as ClipRender["status"],
          output_url: r.output_url,
        });
        grouped.set(r.clip_id, arr);
      });
      return (clipRows ?? []).map((c) => ({
        id: c.id,
        title: c.title,
        hashtags: c.hashtags ?? [],
        score: c.score,
        start_sec: Number(c.start_sec),
        end_sec: Number(c.end_sec),
        transcript: c.transcript,
        virality_reason: c.virality_reason,
        renders: grouped.get(c.id) ?? [],
      })) as ClipCardData[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`project:${id}:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["project", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "clips", filter: `project_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["clips", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "clip_renders", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["clips", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, userId, qc]);

  async function handleRender(clipId: string, ar: AspectRatio) {
    try {
      const res = await render({ data: { clipId, aspectRatio: ar } });
      if (!res.dispatch.dispatched && res.dispatch.reason === "backend_not_configured") {
        toast.message("Render na fila", { description: "Worker ainda não configurado." });
      } else if (!res.dispatch.dispatched) {
        toast.warning("Render na fila, worker falhou.", { description: res.dispatch.reason });
      } else {
        toast.success(`Renderizando em ${ar}…`);
      }
      qc.invalidateQueries({ queryKey: ["clips", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha");
    }
  }

  const p = project.data;

  return (
    <SidebarProvider>
      <div className="grain flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard"><ArrowLeft className="mr-1 size-4" /> Voltar</Link>
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <CreditsBadge credits={credits.data} loading={credits.isLoading} />
              <UserMenu email={email} />
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl space-y-8 px-6 py-8">
            <section className="rounded-2xl border border-border bg-card/40 p-6 backdrop-blur">
              {project.isLoading || !p ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-64" />
                  <Skeleton className="h-4 w-96" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ) : (
                <>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <ProjectStatusBadge status={p.status as ProjectStatus} />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{p.source_type}</span>
                  </div>
                  <h1 className="mb-1 text-xl font-semibold tracking-tight sm:text-2xl">
                    {p.title ?? "Processando metadados…"}
                  </h1>
                  <a href={p.source_url} target="_blank" rel="noreferrer" className="block truncate font-mono text-xs text-muted-foreground hover:text-primary">
                    {p.source_url}
                  </a>
                  {p.error_msg && <p className="mt-2 text-sm text-destructive">{p.error_msg}</p>}
                  <div className="mt-4">
                    <ProjectProgress status={p.status as ProjectStatus} progress={p.progress} />
                  </div>
                </>
              )}
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground">Clipes sugeridos pela IA</h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {clips.data?.length ?? 0} clipes
                </p>
              </div>
              {clips.isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-96 rounded-xl" />)}
                </div>
              ) : (clips.data?.length ?? 0) === 0 ? (
                <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/30 p-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {p?.status === "failed" ? "Falhou — tente outro link." : "Aguardando a IA gerar os clipes…"}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {clips.data!.map((c) => (
                    <ClipCard key={c.id} clip={c} onRender={handleRender} />
                  ))}
                </div>
              )}
            </section>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
