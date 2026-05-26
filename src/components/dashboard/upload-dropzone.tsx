import { useCallback, useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Props = {
  onFile: (file: File, setProgress: (n: number) => void) => Promise<void>;
  disabled?: boolean;
};

export function UploadDropzone({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);

  const handle = useCallback(
    async (file: File) => {
      if (disabled || uploading) return;
      setUploading(true);
      setProgress(5);
      setSuccess(false);
      // ramp simulation up to 90%
      const ramp = setInterval(() => {
        setProgress((p) => (p < 90 ? p + Math.max(1, (90 - p) * 0.08) : p));
      }, 200);
      try {
        await onFile(file, setProgress);
        setProgress(100);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 1800);
      } finally {
        clearInterval(ramp);
        setTimeout(() => {
          setUploading(false);
          setProgress(0);
        }, 600);
      }
    },
    [onFile, disabled, uploading],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handle(f);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !uploading) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !disabled && !uploading && inputRef.current?.click()}
      className={cn(
        "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-all",
        dragging
          ? "border-primary bg-primary/5 shadow-[0_0_0_4px_oklch(0.55_0.24_295_/_0.15)]"
          : "border-border hover:border-primary/60 hover:bg-secondary/40",
        (disabled || uploading) && "pointer-events-none opacity-70",
        success && "border-success bg-success/5",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      {success ? (
        <CheckCircle2 className="size-8 text-success" />
      ) : uploading ? (
        <Loader2 className="size-8 animate-spin text-primary" />
      ) : (
        <div className={cn("grid size-12 place-items-center rounded-full bg-primary/10 text-primary transition", dragging && "scale-110")}>
          <Upload className="size-6" />
        </div>
      )}
      <p className="mt-4 text-sm font-medium">
        {success
          ? "Enviado!"
          : uploading
          ? "Enviando…"
          : dragging
          ? "Solte para enviar"
          : "Clique ou arraste seu vídeo aqui"}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        mp4 · mov · até 500mb · 1 crédito
      </p>
      {uploading && (
        <div className="mt-6 w-full max-w-md">
          <Progress value={progress} className="h-1.5" />
          <p className="mt-2 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
            {Math.round(progress)}%
          </p>
        </div>
      )}
    </div>
  );
}
