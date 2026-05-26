import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CreditsBadge } from "@/components/dashboard/credits-badge";
import { UserMenu } from "@/components/dashboard/user-menu";
import { UrlInput } from "@/components/projects/url-input";
import { ProjectsList, type ProjectRow } from "@/components/projects/projects-list";
import { supabase } from "@/integrations/supabase/client";
import { createProject } from "@/lib/projects.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Painel — Clip Forge" }] }),
});

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const create = useServerFn(createProject);
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

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,source_url,source_type,title,duration_sec,status,progress,error_msg,created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as ProjectRow[];
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`projects:${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "projects", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["projects"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);

  async function handleSubmit(url: string) {
    if (!userId) { toast.error("Não autenticado"); return; }
    if ((credits.data ?? 0) <= 0) { toast.error("Sem créditos disponíveis."); return; }
    try {
      const res = await create({ data: { url } });
      qc.invalidateQueries({ queryKey: ["credits"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      if (!res.dispatch.dispatched && res.dispatch.reason === "backend_not_configured") {
        toast.message("Projeto criado", {
          description: "Worker de processamento ainda não configurado — vai ficar em fila.",
        });
      } else if (!res.dispatch.dispatched) {
        toast.warning("Projeto criado, worker falhou ao receber.", { description: res.dispatch.reason });
      } else {
        toast.success("IA começou a trabalhar 🎬");
      }
      navigate({ to: "/projects/$id", params: { id: res.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha");
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
                <h1 className="text-base font-semibold">Novo projeto</h1>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  link · IA · cortes virais
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CreditsBadge credits={credits.data} loading={credits.isLoading} />
              <UserMenu email={email} />
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl space-y-10 px-6 py-8">
            <UrlInput
              onSubmit={handleSubmit}
              disabled={!userId || (credits.data ?? 0) <= 0}
            />

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground">Seus projetos recentes</h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">tempo real</p>
              </div>
              <ProjectsList projects={projects.data ?? []} loading={projects.isLoading} />
            </section>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
