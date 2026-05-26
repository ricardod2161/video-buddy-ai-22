import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Upload, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Clip Forge — Vídeos longos viram clipes prontos" },
      { name: "description", content: "Faça upload, e receba clipes editados, legendados e narrados. Pronto para postar." },
    ],
  }),
});

function Landing() {
  return (
    <main className="grain min-h-screen">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </div>
          <span className="font-mono text-sm tracking-wider">CLIP/FORGE</span>
        </div>
        <Link
          to="/login"
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary"
        >
          Entrar
        </Link>
      </nav>

      <section className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
          v0.1 · processamento em pipeline
        </p>
        <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
          Vídeos longos.
          <br />
          <span className="text-primary">Clipes prontos.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Envie um vídeo, ganhe créditos no cadastro e receba clipes verticais
          com corte, legenda e narração — direto no painel.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Começar com 10 créditos grátis
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            { icon: Upload, t: "1 · Upload", d: "Mande seu vídeo bruto direto pelo navegador. Armazenamento privado." },
            { icon: Zap, t: "2 · Processamento", d: "Pipeline com FFmpeg, transcrição e narração roda no backend dedicado." },
            { icon: Sparkles, t: "3 · Clipes", d: "Status atualiza em tempo real. Baixe os clipes assim que ficarem prontos." },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-xl border border-border bg-card/40 p-6 backdrop-blur">
              <Icon className="size-5 text-primary" />
              <h3 className="mt-4 font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
