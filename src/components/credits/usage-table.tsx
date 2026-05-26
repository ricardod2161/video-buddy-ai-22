import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProjectStatusBadge, type ProjectStatus } from "@/components/projects/project-status";

export type UsageRow = {
  id: string;
  status: ProjectStatus;
  source_url: string;
  title: string | null;
  created_at: string;
};

export function UsageTable({ rows, loading }: { rows: UsageRow[]; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40 backdrop-blur">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[180px]">Data</TableHead>
            <TableHead>Projeto</TableHead>
            <TableHead className="w-[160px]">Status</TableHead>
            <TableHead className="w-[120px] text-right">Créditos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-10" /></TableCell>
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                Nenhum uso registrado ainda.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const date = new Date(r.created_at).toLocaleString("pt-BR");
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{date}</TableCell>
                  <TableCell className="max-w-[360px]">
                    <p className="truncate text-sm">{r.title ?? r.source_url}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{r.source_url}</p>
                  </TableCell>
                  <TableCell><ProjectStatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right font-mono text-sm text-destructive">−1</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
