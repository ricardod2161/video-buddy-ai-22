import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectStatusBadge, ProjectProgress, type ProjectStatus } from "./project-status";

export type ProjectRow = {
  id: string;
  source_url: string;
  source_type: string;
  title: string | null;
  duration_sec: number | null;
  status: ProjectStatus;
  progress: number;
  error_msg: string | null;
  created_at: string;
};

function fmtDuration(sec: number | null) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ProjectsList({ projects, loading }: { projects: ProjectRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }
  if (projects.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card/30 p-12 text-center">
        <p className="text-sm text-muted-foreground">Nenhum projeto ainda. Cole um link acima.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-3">
      {projects.map((p) => (
        <Link
          key={p.id}
          to="/projects/$id"
          params={{ id: p.id }}
          className="group block rounded-xl border border-border bg-card/40 p-4 backdrop-blur transition-all hover:border-primary/40 hover:bg-card/70"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <ProjectStatusBadge status={p.status} />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {p.source_type}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  · {fmtDuration(p.duration_sec)}
                </span>
              </div>
              <p className="truncate text-sm font-medium">{p.title ?? p.source_url}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{p.source_url}</p>
              {p.error_msg && (
                <p className="mt-1 truncate text-xs text-destructive">{p.error_msg}</p>
              )}
              <div className="mt-3">
                <ProjectProgress status={p.status} progress={p.progress} />
              </div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
          </div>
        </Link>
      ))}
    </div>
  );
}
