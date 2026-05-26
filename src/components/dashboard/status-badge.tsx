import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type VideoStatus = "pending" | "processing" | "completed" | "failed";

const config: Record<VideoStatus, { label: string; icon: typeof Clock; cls: string; spin?: boolean; pulse?: boolean }> = {
  pending: {
    label: "Pendente",
    icon: Clock,
    cls: "bg-muted text-muted-foreground border-border",
  },
  processing: {
    label: "Processando",
    icon: Loader2,
    cls: "bg-warning/15 text-warning border-warning/30 animate-pulse",
    spin: true,
  },
  completed: {
    label: "Pronto",
    icon: CheckCircle2,
    cls: "bg-success/15 text-success border-success/30",
  },
  failed: {
    label: "Falhou",
    icon: XCircle,
    cls: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

export function StatusBadge({ status }: { status: VideoStatus }) {
  const c = config[status];
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", c.cls)}>
      <Icon className={cn("size-3", c.spin && "animate-spin")} />
      {c.label}
    </Badge>
  );
}
