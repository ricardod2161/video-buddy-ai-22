import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, type VideoStatus } from "./status-badge";

export type VideoRow = {
  id: string;
  status: VideoStatus;
  original_url: string;
  output_url: string | null;
  error_msg: string | null;
  created_at: string;
};

export function VideosTable({ videos, loading }: { videos: VideoRow[]; loading: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/40 backdrop-blur">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Nome</TableHead>
            <TableHead className="w-[160px]">Status</TableHead>
            <TableHead className="w-[180px]">Data</TableHead>
            <TableHead className="w-[140px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-24" /></TableCell>
              </TableRow>
            ))
          ) : videos.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                Nenhum vídeo enviado ainda.
              </TableCell>
            </TableRow>
          ) : (
            videos.map((v) => {
              const name = v.original_url.split("/").pop() ?? v.id;
              const date = new Date(v.created_at).toLocaleString("pt-BR");
              const canDownload = v.status === "completed" && !!v.output_url;
              return (
                <TableRow key={v.id}>
                  <TableCell className="max-w-[320px]">
                    <p className="truncate font-mono text-sm">{name}</p>
                    {v.error_msg && (
                      <p className="truncate text-xs text-destructive">{v.error_msg}</p>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={v.status} /></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{date}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      asChild={canDownload}
                      disabled={!canDownload}
                      variant="outline"
                      size="sm"
                    >
                      {canDownload ? (
                        <a href={v.output_url!} target="_blank" rel="noreferrer">
                          <Download className="mr-1.5 size-3.5" /> Download
                        </a>
                      ) : (
                        <span>
                          <Download className="mr-1.5 size-3.5" /> Download
                        </span>
                      )}
                    </Button>
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
