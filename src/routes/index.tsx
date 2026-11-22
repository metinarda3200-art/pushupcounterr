import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Flame, Medal, PlayCircle, ScanLine, Timer } from "lucide-react";

import heroImg from "@/assets/hero-pushup.jpg";
import { Button } from "@/components/ui/button";
import { RankBadge } from "@/components/game/RankBadge";
import { AnimatedSkeleton } from "@/components/site/AnimatedSkeleton";
import { TIERS } from "@/lib/game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tekrar — Yapay Zekâ ile Şınav ve Barfiks Sayacı" },
      { name: "description", content: "Kameranı aç, yapay zekâ şınav ve barfiks tekrarlarını hareket aralığına göre saysın. XP kazan, rank atla, sıralamaya gir." },
      { property: "og:title", content: "Tekrar — Yapay Zekâ ile Şınav ve Barfiks Sayacı" },
      { property: "og:description", content: "Her tekrar sayılır, hilesi yok. Bronzdan Şampiyona yüksel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const WORDS = ["Şınav", "Barfiks", "0,5 yarım tekrar", "Combo", "Elmas", "Şampiyon", "60 sn meydan okuma"];

function Home() {
  return (
    <main className="animate-page-in">
      <section className="relative overflow-hidden">
        <img src={heroImg} alt="Karanlık salonda şınav çeken sporcu" className="absolute inset-0 h-full w-full object-cover object-right opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/10" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1.3fr_1fr] md:py-24">
          <div>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-ember">
              <ScanLine className="size-3.5" /> Yapay zekâ form takibi
            </p>
            <h1 className="text-stencil mt-4 text-6xl text-bone sm:text-8xl">
              Her tekrar <span className="text-gradient-ember">sayılır.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg text-muted-foreground">
              Kameranı aç, yapay zekâ iskeletini takip etsin. Tam tekrar 1, yarım tekrar 0,5. Hilesi yok.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="ember" size="xl">
                <Link to="/oyun"><Camera /> Oyuna başla</Link>
              </Button>
              <Button asChild variant="hud" size="xl">
                <Link to="/form"><PlayCircle /> Doğru formu öğren</Link>
              </Button>
            </div>
          </div>
          <div className="surface-glass self-end rounded-2xl p-4 text-bone">
            <AnimatedSkeleton />
          </div>
        </div>
      </section>

      <div className="overflow-hidden border-y border-border bg-surface py-3">
        <div className="flex w-max animate-marquee gap-10">
          {[...WORDS, ...WORDS].map((w, i) => (
            <span key={i} className="text-stencil text-2xl text-muted-foreground">{w} <span className="text-ember">•</span></span>
          ))}
        </div>
      </div>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:px-6 md:grid-cols-3">
        {[
          { icon: Camera, title: "Kamerayı yana koy", text: "Baş, gövde ve bacaklar görünsün. Beyaz iskelet noktaları üstünde belirir." },
          { icon: Flame, title: "Combo yap", text: "Art arda tam tekrarlar XP'ni katlar. Yarım tekrar combo'yu bozar." },
          { icon: Timer, title: "60 sn meydan okuma", text: "Süre içinde en çok tekrarı çek, rekorunu kır." },
        ].map((f, i) => (
          <div key={f.title} className={`animate-page-in delay-${i + 1} rounded-2xl border border-border bg-surface p-5 transition-transform hover:-translate-y-1`}>
            <f.icon className="size-6 text-ember" />
            <p className="text-stencil mt-3 text-2xl text-bone">{f.title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="rounded-3xl border border-border bg-surface p-6 sm:p-10">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-ember"><Medal className="size-4" /> Rank sistemi</p>
          <h2 className="text-stencil mt-2 text-4xl text-bone sm:text-5xl">Bronzdan Şampiyona</h2>
          <div className="mt-8 grid grid-cols-3 gap-4 sm:grid-cols-6">
            {TIERS.map((t, i) => (
              <div key={t.id} className="flex flex-col items-center text-center transition-transform hover:scale-110">
                <RankBadge tier={t.id} size={72} glow={i >= 4} />
                <p className="text-stencil mt-2 text-lg text-bone">{t.name}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{t.min.toLocaleString("tr-TR")} XP</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="ember"><Link to="/rank">Rankını gör</Link></Button>
            <Button asChild variant="outline"><Link to="/siralama">Sıralama</Link></Button>
          </div>
        </div>
      </section>
    </main>
  );
}
