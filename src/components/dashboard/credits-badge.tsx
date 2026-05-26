import { Coins } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function CreditsBadge({ credits, loading }: { credits: number | undefined; loading?: boolean }) {
  if (loading) return <Skeleton className="h-9 w-24 rounded-full" />;
  const empty = (credits ?? 0) <= 0;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold",
        empty
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-primary/40 bg-primary/10 text-primary",
      )}
    >
      <Coins className="size-4" />
      <span className="tabular-nums">{credits ?? 0}</span>
      <span className="hidden font-mono text-[10px] uppercase tracking-widest opacity-70 sm:inline">
        créditos
      </span>
    </div>
  );
}
