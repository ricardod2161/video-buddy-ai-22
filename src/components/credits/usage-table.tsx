import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, type VideoStatus } from "@/components/dashboard/status-badge";

export type UsageRow = {
  id: string;
  status: VideoStatus;
  original_url: string;
  created_at: string;
};

export function UsageTable({ rows, loading }: { rows: UsageRow[]; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40 backdrop-blur">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[180px]">Data</TableHead>
            <TableHead>Vídeo</TableHead>
            <TableHead className="w-[160px]">Status</TableHead>
            <TableHead className="w-[140px] text-right">Créditos</TableHead>
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
              const name = r.original_url.split("/").pop() ?? r.id;
              const date = new Date(r.created_at).toLocaleString("pt-BR");
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{date}</TableCell>
                  <TableCell className="max-w-[320px]">
                    <p className="truncate font-mono text-sm">{name}</p>
                  </TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right font-mono text-sm text-destructive">
                    −1
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
