import { CheckCircle2, Clock, Loader2, XCircle, Download, Brain, Scissors, Film } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ProjectStatus =
  | "queued"
  | "downloading"
  | "transcribing"
  | "analyzing"
  | "rendering"
  | "done"
  | "failed";

const map: Record<ProjectStatus, { label: string; icon: typeof Clock; cls: string; spin?: boolean }> = {
  queued:       { label: "Na fila",       icon: Clock,        cls: "bg-muted text-muted-foreground border-border" },
  downloading:  { label: "Baixando",      icon: Download,     cls: "bg-primary/15 text-primary border-primary/30", spin: true },
  transcribing: { label: "Transcrevendo", icon: Film,         cls: "bg-primary/15 text-primary border-primary/30", spin: true },
  analyzing:    { label: "Analisando IA", icon: Brain,        cls: "bg-primary/15 text-primary border-primary/30", spin: true },
  rendering:    { label: "Renderizando",  icon: Scissors,     cls: "bg-warning/15 text-warning border-warning/30", spin: true },
  done:         { label: "Pronto",        icon: CheckCircle2, cls: "bg-success/15 text-success border-success/30" },
  failed:       { label: "Falhou",        icon: XCircle,      cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const c = map[status] ?? map.queued;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", c.cls)}>
      <Icon className={cn("size-3", c.spin && "animate-spin")} />
      {c.label}
    </Badge>
  );
}

export function ProjectProgress({ status, progress }: { status: ProjectStatus; progress: number }) {
  if (status === "done" || status === "failed") return null;
  return <Progress value={progress} className="h-1.5" />;
}
