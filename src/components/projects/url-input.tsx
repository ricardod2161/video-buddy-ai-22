import { useState } from "react";
import { Loader2, Link2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const URL_RE = /^https?:\/\/[^\s]+$/i;

export function UrlInput({
  onSubmit,
  disabled,
}: {
  onSubmit: (url: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const valid = URL_RE.test(url.trim());

  async function go() {
    setTouched(true);
    if (!valid || busy || disabled) return;
    setBusy(true);
    try {
      await onSubmit(url.trim());
      setUrl("");
      setTouched(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card/40 to-card/40 p-6 backdrop-blur sm:p-10">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Novo projeto
        </p>
        <h2 className="mb-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Cole o link do vídeo
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          YouTube · TikTok · Vimeo · Twitch · ou link direto .mp4 — a IA cuida do resto.
        </p>

        <div
          className={cn(
            "group flex items-center gap-2 rounded-xl border bg-background/60 p-2 shadow-sm transition-all",
            touched && !valid ? "border-destructive/50" : "border-border focus-within:border-primary/60",
            "focus-within:shadow-[0_0_0_4px_oklch(0.55_0.24_295_/_0.12)]",
          )}
        >
          <Link2 className="ml-2 size-4 shrink-0 text-muted-foreground" />
          <Input
            type="url"
            inputMode="url"
            placeholder="https://youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            onBlur={() => setTouched(true)}
            disabled={busy || disabled}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button onClick={go} disabled={busy || disabled || !valid} className="shrink-0">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            <span className="ml-2 hidden sm:inline">Gerar cortes</span>
          </Button>
        </div>

        {touched && !valid && url.length > 0 && (
          <p className="mt-2 text-left text-xs text-destructive">URL inválida.</p>
        )}

        <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          1 crédito por projeto · até 2h de vídeo
        </p>
      </div>
    </div>
  );
}
