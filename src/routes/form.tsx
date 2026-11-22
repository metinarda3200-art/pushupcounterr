import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play } from "lucide-react";

import type { Exercise } from "@/lib/rep-counter";

export const Route = createFileRoute("/form")({
  head: () => ({
    meta: [
      { title: "Doğru Şınav ve Barfiks Formu — Videolu Anlatım | Tekrar" },
      { name: "description", content: "Doğru şınav ve barfiks tekniğini videoyla öğren: adımlar, sık yapılan hatalar ve yapay zekânın neyi kontrol ettiği." },
      { property: "og:title", content: "Doğru Şınav ve Barfiks Formu" },
      { property: "og:description", content: "Videolu anlatım ve sık yapılan hatalar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FormPage,
});

const CONTENT: Record<Exercise, { video: string; title: string; steps: string[]; mistakes: string[] }> = {
  pushup: {
    video: "IODxDxX7oi4",
    title: "Doğru şınav",
    steps: [
      "Elleri omuz genişliğinde, omuzların altına koy.",
      "Baştan topuğa düz bir çizgi oluştur, karnını sık.",
      "Dirsekler gövdeye ~45° açıyla, göğüs yere yaklaşana kadar in (~90° dirsek).",
      "Yeri it, kolları tamamen düzleştir.",
    ],
    mistakes: ["Belin çökmesi ya da kalçanın yükselmesi", "Dirsekleri T şeklinde yana açmak", "Yarım inmek (uygulama 0,5 sayar)"],
  },
  pullup: {
    video: "eGo4IYlbE5g",
    title: "Doğru barfiks",
    steps: [
      "Barı omuz genişliğinden biraz açık tut, kollar tam açık asıl.",
      "Kürek kemiklerini aşağı çek, gövdeyi sabit tut.",
      "Çeneni barın üstüne çıkana kadar çek.",
      "Kontrollü şekilde tam asılı pozisyona in.",
    ],
    mistakes: ["Sallanarak (kipping) çekmek", "Aşağıda kolları tam açmamak", "Çeneyi barın üstüne çıkarmamak (0,5 sayılır)"],
  },
};

function FormPage() {
  const [ex, setEx] = useState<Exercise>("pushup");
  const c = CONTENT[ex];
  return (
    <main className="mx-auto max-w-4xl animate-page-in px-4 py-8 sm:px-6">
      <h1 className="text-stencil text-5xl text-bone">Doğru form</h1>
      <div className="mt-5 grid grid-cols-2 rounded-xl border border-border bg-surface p-1">
        {(["pushup", "pullup"] as const).map((e) => (
          <button key={e} onClick={() => setEx(e)} className={`rounded-lg py-2 text-sm font-semibold ${ex === e ? "bg-surface-raised text-bone" : "text-muted-foreground"}`}>
            {e === "pushup" ? "Şınav" : "Barfiks"}
          </button>
        ))}
      </div>
      <Video key={c.video} id={c.video} title={c.title} />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-stencil text-2xl text-bone">Adım adım</h2>
          <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
            {c.steps.map((s, i) => (
              <li key={s} className="flex gap-3"><span className="font-mono text-ember">0{i + 1}</span>{s}</li>
            ))}
          </ol>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-stencil text-2xl text-bone">Sık yapılan hatalar</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {c.mistakes.map((m) => <li key={m} className="flex gap-3"><span className="text-destructive">✕</span>{m}</li>)}
          </ul>
        </section>
      </div>
    </main>
  );
}

function Video({ id, title }: { id: string; title: string }) {
  const [play, setPlay] = useState(false);
  return (
    <div className="relative mt-5 aspect-video overflow-hidden rounded-2xl border border-border bg-surface">
      {play ? (
        <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : (
        <button onClick={() => setPlay(true)} className="group absolute inset-0" aria-label={`${title} videosunu oynat`}>
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-ember text-ember-foreground shadow-2xl transition-transform group-hover:scale-110">
              <Play className="size-8" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
