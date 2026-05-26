import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { AppSidebar } from "@/components/app-sidebar";
import { CreditsBadge } from "@/components/dashboard/credits-badge";
import { UserMenu } from "@/components/dashboard/user-menu";
import { PurchaseCard } from "@/components/credits/purchase-card";
import { UsageTable, type UsageRow } from "@/components/credits/usage-table";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/credits")({
  component: CreditsPage,
  head: () => ({
    meta: [
      { title: "Créditos — Clip Forge" },
      { name: "description", content: "Saldo, histórico de uso e compra de créditos." },
    ],
  }),
});

function CreditsPage() {
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
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

  const usage = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,status,source_url,title,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UsageRow[];
    },
  });

  const totalConsumed = usage.data?.length ?? 0;

  return (
    <SidebarProvider>
      <div className="grain flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div>
                <h1 className="text-base font-semibold">Créditos</h1>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  saldo · histórico · compra
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CreditsBadge credits={credits.data} loading={credits.isLoading} />
              <UserMenu email={email} />
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
            <section className="rounded-xl border border-border bg-gradient-to-br from-primary/10 via-card/40 to-card/40 p-6 backdrop-blur">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Coins className="size-4 text-primary" />
                    <span className="font-mono uppercase tracking-widest text-[10px]">
                      Saldo atual
                    </span>
                  </div>
                  {credits.isLoading ? (
                    <Skeleton className="h-12 w-32" />
                  ) : (
                    <p className="text-5xl font-semibold tracking-tight">
                      {credits.data ?? 0}
                      <span className="ml-2 text-base font-normal text-muted-foreground">
                        créditos
                      </span>
                    </p>
                  )}
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>
                    Total consumido:{" "}
                    <span className="font-mono text-foreground">{totalConsumed}</span>
                  </p>
                </div>
              </div>
            </section>

            <section>
              <PurchaseCard />
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Histórico de uso
                </h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  cada vídeo = 1 crédito
                </p>
              </div>
              <UsageTable rows={usage.data ?? []} loading={usage.isLoading} />
            </section>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
