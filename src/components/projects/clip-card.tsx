import { useState } from "react";
import { Download, Loader2, Copy, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const ASPECT_RATIOS = [
  { id: "9:16", label: "9:16", hint: "Shorts / Reels / TikTok" },
  { id: "1:1",  label: "1:1",  hint: "IG Feed" },
  { id: "16:9", label: "16:9", hint: "YouTube" },
  { id: "4:5",  label: "4:5",  hint: "IG Retrato" },
] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number]["id"];

export type ClipRender = {
  id: string;
  aspect_ratio: AspectRatio;
  status: "queued" | "rendering" | "done" | "failed";
  output_url: string | null;
};

export type ClipCardData = {
  id: string;
  title: string;
  hashtags: string[];
  score: number;
  start_sec: number;
  end_sec: number;
  transcript: string | null;
  virality_reason: string | null;
  renders: ClipRender[];
};

function fmtTs(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function ClipCard({
  clip,
  onRender,
}: {
  clip: ClipCardData;
  onRender: (clipId: string, ar: AspectRatio) => Promise<void>;
}) {
  const [ar, setAr] = useState<AspectRatio>("9:16");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const render = clip.renders.find((r) => r.aspect_ratio === ar);
  const duration = clip.end_sec - clip.start_sec;

  async function handleRender() {
    setBusy(true);
    try { await onRender(clip.id, ar); } finally { setBusy(false); }
  }

  function copyCaption() {
    const txt = `${clip.title}\n\n${clip.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`;
    navigator.clipboard.writeText(txt);
    setCopied(true);
    toast.success("Legenda copiada");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card/40 backdrop-blur transition-all hover:border-primary/40">
      <div className={cn(
        "relative grid place-items-center bg-gradient-to-br from-primary/20 via-primary/5 to-card/20",
        ar === "9:16" && "aspect-[9/16]",
        ar === "1:1" && "aspect-square",
        ar === "16:9" && "aspect-video",
        ar === "4:5" && "aspect-[4/5]",
      )}>
        {render?.status === "done" && render.output_url ? (
          <video src={render.output_url} controls className="h-full w-full object-cover" preload="metadata" />
        ) : render?.status === "rendering" || render?.status === "queued" ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-widest">renderizando</span>
          </div>
        ) : render?.status === "failed" ? (
          <div className="text-xs text-destructive">Falhou</div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Sparkles className="size-6 text-primary/50" />
            <span className="font-mono text-[10px] uppercase tracking-widest">prévia</span>
          </div>
        )}
        <Badge className="absolute left-2 top-2 bg-background/80 text-foreground" variant="outline">
          <span className="font-mono text-[10px]">★ {clip.score}</span>
        </Badge>
        <Badge className="absolute right-2 top-2 bg-background/80 text-foreground" variant="outline">
          <span className="font-mono text-[10px]">{Math.round(duration)}s</span>
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold">{clip.title}</h3>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {fmtTs(clip.start_sec)} → {fmtTs(clip.end_sec)}
          </p>
        </div>

        {clip.virality_reason && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{clip.virality_reason}</p>
        )}

        {clip.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {clip.hashtags.slice(0, 4).map((h) => (
              <Badge key={h} variant="secondary" className="font-mono text-[10px]">
                #{h.replace(/^#/, "")}
              </Badge>
            ))}
          </div>
        )}

        <Tabs value={ar} onValueChange={(v) => setAr(v as AspectRatio)} className="mt-auto">
          <TabsList className="grid w-full grid-cols-4">
            {ASPECT_RATIOS.map((a) => (
              <TabsTrigger key={a.id} value={a.id} className="font-mono text-[10px]">{a.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          {render?.status === "done" && render.output_url ? (
            <Button asChild size="sm" className="flex-1">
              <a href={render.output_url} target="_blank" rel="noreferrer" download>
                <Download className="mr-1.5 size-3.5" />
                Baixar {ar}
              </a>
            </Button>
          ) : (
            <Button
              onClick={handleRender}
              disabled={busy || render?.status === "rendering" || render?.status === "queued"}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              {busy || render?.status === "rendering" || render?.status === "queued" ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 size-3.5" />
              )}
              {render?.status === "failed" ? "Tentar de novo" : `Renderizar ${ar}`}
            </Button>
          )}
          <Button onClick={copyCaption} size="sm" variant="ghost">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
