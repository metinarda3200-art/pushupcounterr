import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { RotateCcw, ScanLine, TriangleAlert } from "lucide-react";

import { PoseCamera } from "@/components/PoseCamera";
import { Button } from "@/components/ui/button";
import { computeMetrics, type Landmark } from "@/lib/pose-metrics";
import {
  THRESHOLDS,
  formatCount,
  initialState,
  step,
  type CounterState,
  type Exercise,
  type RepEvent,
} from "@/lib/rep-counter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tekrar — Yapay Zekâ ile Şınav ve Barfiks Sayacı" },
      {
        name: "description",
        content:
          "Kameranla şınav ve barfiks tekrarlarını yapay zekâ sayar. İskelet takibi, hareket aralığı kontrolü ve 0,5 yarım tekrar.",
      },
      { property: "og:title", content: "Tekrar — Yapay Zekâ ile Şınav ve Barfiks Sayacı" },
      {
        property: "og:description",
        content: "Kamerada iskelet takibiyle şınav ve barfiks tekrarlarını hareket aralığına göre say.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const LABELS: Record<Exercise, string> = { pushup: "Şınav", pullup: "Barfiks" };

type Live = {
  angle: number | null;
  bodyVisible: boolean;
  tracking: boolean;
  phase: CounterState["phase"];
  armed: boolean;
};

function Index() {
  const [active, setActive] = useState<Exercise>("pushup");
  const [counts, setCounts] = useState<Record<Exercise, number>>({ pushup: 0, pullup: 0 });
  const [flash, setFlash] = useState<{ ex: Exercise; ev: Exclude<RepEvent, null>; id: number } | null>(null);
  const [live, setLive] = useState<Live>({ angle: null, bodyVisible: false, tracking: false, phase: "up", armed: false });

  const counters = useRef<Record<Exercise, CounterState>>({ pushup: initialState(), pullup: initialState() });
  const smooth = useRef<number | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const lastUi = useRef(0);

  const onLandmarks = useCallback((lms: Landmark[] | null) => {
    const ex = activeRef.current;
    if (!lms) {
      smooth.current = null;
      setLive((l) => ({ ...l, tracking: false, angle: null }));
      return;
    }
    const m = computeMetrics(lms, ex);
    if (m.angle !== null) {
      smooth.current = smooth.current === null ? m.angle : smooth.current * 0.5 + m.angle * 0.5;
      const { state, event } = step(counters.current[ex], smooth.current, THRESHOLDS[ex]);
      counters.current[ex] = state;
      if (event) {
        setCounts((c) => ({ ...c, [ex]: state.count }));
        setFlash({ ex, ev: event, id: performance.now() });
      }
    }
    const now = performance.now();
    if (now - lastUi.current > 80) {
      lastUi.current = now;
      const s = counters.current[ex];
      setLive({
        angle: smooth.current,
        bodyVisible: m.bodyVisible,
        tracking: true,
        phase: s.phase,
        armed: s.armed,
      });
    }
  }, []);

  const select = (ex: Exercise) => {
    setActive(ex);
    smooth.current = null;
    // re-arm so the new exercise waits for a clean start position
    counters.current[ex] = { ...initialState(), count: counters.current[ex].count };
  };

  const reset = (ex: Exercise) => {
    counters.current[ex] = initialState();
    setCounts((c) => ({ ...c, [ex]: 0 }));
  };

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pb-12 pt-6 sm:px-6 sm:pt-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-ember">
            <ScanLine className="size-3.5" /> Yapay zekâ form takibi
          </p>
          <h1 className="text-stencil mt-2 text-5xl text-bone sm:text-7xl">Tekrar</h1>
        </div>
        <p className="hidden max-w-xs text-right text-sm text-muted-foreground sm:block">
          Tam hareket aralığı = 1 tekrar. Yarım iniş ya da yarım çekiş = 0,5.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:gap-4" aria-label="Egzersizler">
        {(["pushup", "pullup"] as const).map((ex) => (
          <CountBox
            key={ex}
            exercise={ex}
            count={counts[ex]}
            active={active === ex}
            flash={flash?.ex === ex ? flash : null}
            onSelect={() => select(ex)}
            onReset={() => reset(ex)}
          />
        ))}
      </section>

      <PoseCamera onLandmarks={onLandmarks}>
        <Hud exercise={active} live={live} />
      </PoseCamera>

      <section className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
        <Tip n="01" title="Yandan çek">
          Kamerayı vücudunun yan tarafına, 2–3 metre uzağa yerleştir. Baş, gövde ve bacaklar görünmeli.
        </Tip>
        <Tip n="02" title="Kolları aç">
          Sayım, kolların tam açık başlangıç pozisyonunu gördükten sonra başlar.
        </Tip>
        <Tip n="03" title="Aralığı tamamla">
          Şınavda dirsek ~90°'ye in, barfikste çeneni barın üstüne çıkar. Yarısı 0,5 sayılır.
        </Tip>
      </section>
    </main>
  );
}

function CountBox({
  exercise,
  count,
  active,
  flash,
  onSelect,
  onReset,
}: {
  exercise: Exercise;
  count: number;
  active: boolean;
  flash: { ev: "full" | "half"; id: number } | null;
  onSelect: () => void;
  onReset: () => void;
}) {
  const isPush = exercise === "pushup";
  const tone = isPush ? "text-ember" : "text-volt";
  const ring = isPush ? "border-ember shadow-[0_0_0_1px_var(--ember),0_20px_60px_-25px_var(--ember)]" : "border-volt shadow-[0_0_0_1px_var(--volt),0_20px_60px_-25px_var(--volt)]";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
      aria-pressed={active}
      aria-label={`${LABELS[exercise]} sayacı`}
      className={`relative cursor-pointer overflow-hidden rounded-2xl border bg-surface p-4 text-left transition-all sm:p-6 ${
        active ? ring : "border-border opacity-70 hover:opacity-100"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-stencil text-xl sm:text-3xl ${active ? tone : "text-muted-foreground"}`}>
          {LABELS[exercise]}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {active ? "● Sayılıyor" : "Seç"}
        </span>
      </div>

      <div className="relative mt-3 flex items-baseline gap-2 sm:mt-6">
        <span
          key={flash?.id ?? "static"}
          className={`text-stencil text-7xl tabular-nums text-bone sm:text-9xl ${flash ? "animate-rep-pop" : ""}`}
          data-testid={`count-${exercise}`}
        >
          {formatCount(count)}
        </span>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">tekrar</span>
        {flash && (
          <span key={`f-${flash.id}`} className={`text-stencil animate-float-up absolute -top-2 right-0 text-2xl ${tone}`}>
            {flash.ev === "full" ? "+1" : "+0,5"}
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-2 -ml-2 text-muted-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onReset();
        }}
      >
        <RotateCcw /> Sıfırla
      </Button>
    </div>
  );
}

function Hud({ exercise, live }: { exercise: Exercise; live: Live }) {
  const t = THRESHOLDS[exercise];
  const isPush = exercise === "pushup";
  const bar = isPush ? "bg-ember" : "bg-volt";
  // 0% = arms straight, 100% = full range reached
  const depth = live.angle === null ? 0 : Math.max(0, Math.min(1, (t.top + 15 - live.angle) / (t.top + 15 - t.bottom)));
  const halfMark = (t.top + 15 - t.half) / (t.top + 15 - t.bottom);

  let hint: string;
  if (!live.tracking) hint = "Vücut aranıyor…";
  else if (live.angle === null) hint = "Kollar görünmüyor";
  else if (!live.armed) hint = isPush ? "Kolları düz aç" : "Bara asıl, kolları aç";
  else if (live.phase === "up") hint = isPush ? "İn" : "Çek";
  else if (live.phase === "descending") hint = isPush ? "Daha aşağı" : "Daha yukarı";
  else hint = isPush ? "Yukarı it" : "Kontrollü in";

  return (
    <>
      <div className="absolute left-3 top-3 flex flex-col gap-2">
        <span className="rounded-md bg-scrim px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest text-bone backdrop-blur-md">
          {LABELS[exercise]} · {live.angle === null ? "--" : `${Math.round(live.angle)}°`}
        </span>
        {live.tracking && !live.bodyVisible && (
          <span className="flex items-center gap-1.5 rounded-md bg-destructive/90 px-2.5 py-1 text-xs font-medium text-destructive-foreground">
            <TriangleAlert className="size-3.5" /> Baş, gövde ve bacaklar kadrajda olsun
          </span>
        )}
      </div>

      <div className="absolute inset-x-3 bottom-3 rounded-xl bg-scrim p-3 backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-stencil text-xl text-bone sm:text-2xl">{hint}</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Hareket aralığı</span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-raised">
          <div className={`h-full ${bar} transition-[width] duration-100`} style={{ width: `${depth * 100}%` }} />
          <div className="absolute inset-y-0 w-0.5 bg-bone/70" style={{ left: `${halfMark * 100}%` }} />
        </div>
        <div className="relative mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>Başlangıç</span>
          <span className="absolute -translate-x-1/2" style={{ left: `${halfMark * 100}%` }}>
            0,5
          </span>
          <span>1</span>
        </div>
      </div>
    </>
  );
}

function Tip({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-4">
      <p className="font-mono text-[11px] text-ember">{n}</p>
      <p className="mt-1 font-semibold text-foreground">{title}</p>
      <p className="mt-1">{children}</p>
    </div>
  );
}
