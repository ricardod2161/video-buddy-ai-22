import { useState } from "react";
import { Coins, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Pack = { id: string; credits: number; priceUsd: number; highlight?: boolean };

const PACKS: Pack[] = [
  { id: "starter", credits: 10, priceUsd: 9 },
  { id: "pro", credits: 50, priceUsd: 39, highlight: true },
  { id: "scale", credits: 200, priceUsd: 129 },
];

export function PurchaseCard() {
  const [selected, setSelected] = useState<string>("pro");

  function handleCheckout() {
    toast.message("Checkout em breve", {
      description: "Integração com Stripe ainda não configurada neste projeto.",
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-6 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Comprar créditos</h3>
          <p className="text-sm text-muted-foreground">
            Cada crédito = 1 processamento de vídeo.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {PACKS.map((p) => {
          const isSelected = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className={cn(
                "group relative rounded-lg border bg-background/40 p-4 text-left transition",
                isSelected
                  ? "border-primary ring-2 ring-primary/30"
                  : "border-border hover:border-primary/50",
              )}
            >
              {p.highlight && (
                <span className="absolute -top-2 right-3 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
                  <Sparkles className="size-3" /> popular
                </span>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Coins className="size-4" />
                <span className="font-mono uppercase tracking-wider text-[10px]">
                  {p.id}
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold">{p.credits} créditos</p>
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                US$ {p.priceUsd}
              </p>
            </button>
          );
        })}
      </div>
      <Button onClick={handleCheckout} className="mt-5 w-full sm:w-auto" size="lg">
        Ir para checkout
      </Button>
    </div>
  );
}
