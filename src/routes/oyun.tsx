import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Flame, Timer, Volume2, VolumeX, Zap } from "lucide-react";
import { toast } from "sonner";

import { PoseCamera } from "@/components/PoseCamera";
import { Button } from "@/components/ui/button";
import { RankBadge } from "@/components/game/RankBadge";
import {
  Banner,
  ChallengeResult,
  CountBox,
  LABELS,
  RankUpOverlay,
  type BannerKind,
} from "@/components/game/GameUi";
import { useAuth } from "@/lib/auth-context";
import { nextCombo, rankFor, xpForRep, type TierId } from "@/lib/game";
import { computeMetrics, type Landmark, type PoseIssue } from "@/lib/pose-metrics";
import { myProfileQuery } from "@/lib/queries";
import {
  THRESHOLDS,
  initialState,
  step,
  type CounterState,
  type Exercise,
  type RepEvent,
} from "@/lib/rep-counter";
import { SessionSync } from "@/lib/session-sync";

export const Route = createFileRoute("/oyun")({
  head: () => ({
    meta: [
      { title: "Oyun — Şınav ve Barfiks Say, XP Kazan | Tekrar" },
      {
        name: "description",
        content: "Kameranı aç, şınav ve barfiks çek. Yapay zekâ her tekrarı sayar, combo yap, XP kazan ve 60 saniye meydan okumasında rekor kır.",
      },
      { property: "og:title", content: "Oyun — Şınav ve Barfiks Say, XP Kazan" },
      { property: "og:description", content: "Yapay zekâ sayar, sen combo yap ve rank atla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GamePage,
});

type Mode = "free" | "challenge60";
type Live = { angle: number | null; tracking: boolean; issue: PoseIssue; bodyVisible: boolean; phase: CounterState["phase"]; armed: boolean };
type Challenge = { state: "idle" | "countdown" | "running"; countdown: number; endsAt: number };

const CHALLENGE_MS = 60_000;

let audioCtx: AudioContext | null = null;
function beep(freq: number, dur = 0.09) {
  try {
    audioCtx ??= new AudioContext();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.06, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch {
    /* audio unavailable */
  }
}

function GamePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const profile = useQuery({ ...myProfileQuery(user?.id ?? ""), enabled: !!user });

  const [exercise, setExercise] = useState<Exercise>("pushup");
  const [mode, setMode] = useState<Mode>("free");
  const [counts, setCounts] = useState<Record<Exercise, number>>({ pushup: 0, pullup: 0 });
  const [pop, setPop] = useState<{ ex: Exercise; text: string; id: number } | null>(null);
  const [combo, setCombo] = useState(0);
  const [gameXp, setGameXp] = useState(0);
  const [banner, setBanner] = useState<{ kind: BannerKind; title: string; sub: string; id: number } | null>(null);
  const [live, setLive] = useState<Live>({ angle: null, tracking: false, issue: null, bodyVisible: false, phase: "up", armed: false });
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(true);
  const [challenge, setChallenge] = useState<Challenge>({ state: "idle", countdown: 0, endsAt: 0 });
  const [timeLeft, setTimeLeft] = useState(CHALLENGE_MS);
  const [result, setResult] = useState<{ exercise: Exercise; score: number; best: number; isRecord: boolean; xp: number } | null>(null);
  const [rankUp, setRankUp] = useState<{ label: string; tier: TierId; division: string | null } | null>(null);

  // Refs read inside the per-frame callback
  const counters = useRef<Record<Exercise, CounterState>>({ pushup: initialState(), pullup: initialState() });
  const smooth = useRef<{ angle: number | null; height: number | null }>({ angle: null, height: null });
  const exRef = useRef(exercise);
  exRef.current = exercise;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const challengeRef = useRef(challenge);
  challengeRef.current = challenge;
  const comboRef = useRef(0);
  const bestComboRef = useRef<Record<string, number>>({});
  const sessionXp = useRef<Record<string, number>>({});
  const gameXpRef = useRef(0);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const syncs = useRef<Record<string, SessionSync>>({});
  const userRef = useRef(user);
  userRef.current = user;
  const baseXp = useRef<number | null>(null);
  const lastUi = useRef(0);
  const lastPoseWarn = useRef(0);
  const challengeXp = useRef(0);

  // Remember the cloud XP once per visit; live XP = base + what we earn here.
  useEffect(() => {
    if (profile.data && baseXp.current === null) baseXp.current = profile.data.xp;
  }, [profile.data]);

  const totalXp = (baseXp.current ?? 0) + gameXp;
  const rank = rankFor(totalXp);

  const syncFor = useCallback((ex: Exercise, m: Mode) => {
    if (!userRef.current) return null;
    const key = `${ex}-${m}`;
    if (!syncs.current[key]) {
      syncs.current[key] = new SessionSync(ex, m, (msg) => {
        console.error(msg);
        toast.error("Tekrarlar kaydedilemedi", { id: "sync-error" });
      });
    }
    return syncs.current[key];
  }, []);

  // Flush everything when leaving the page or hiding the tab
  useEffect(() => {
    const flushAll = () => Object.values(syncs.current).forEach((s) => void s.flush());
    const onVis = () => document.visibilityState === "hidden" && flushAll();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      flushAll();
      void queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      void queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    };
  }, [queryClient]);

  const showBanner = (kind: BannerKind, title: string, sub: string) =>
    setBanner({ kind, title, sub, id: performance.now() });

  const handleEvent = useCallback(
    (ex: Exercise, event: RepEvent, count: number) => {
      const m = modeRef.current;
      if (event === "shallow") {
        comboRef.current = 0;
        setCombo(0);
        showBanner("shallow", "Sayılmadı", ex === "pushup" ? "Çok az indin, göğsünü yere yaklaştır" : "Çok az çektin, kollarını daha çok bük");
        if (soundRef.current) beep(180, 0.18);
        navigator.vibrate?.([40, 40, 40]);
        return;
      }
      if (event !== "full" && event !== "half") return;

      const newCombo = nextCombo(comboRef.current, event);
      const gained = xpForRep(ex, event, newCombo);
      comboRef.current = newCombo;
      setCombo(newCombo);
      setCounts((c) => ({ ...c, [ex]: count }));
      setPop({ ex, text: event === "full" ? `+1 · ${gained} XP` : `+0,5`, id: performance.now() });

      if (event === "half") {
        showBanner("half", "Yarım tekrar · +0,5", ex === "pushup" ? "Tam tekrar için daha aşağı in" : "Tam tekrar için çeneni barın üstüne çıkar");
        if (soundRef.current) beep(440, 0.12);
        navigator.vibrate?.(60);
      } else {
        if (soundRef.current) beep(880 + Math.min(newCombo, 10) * 40);
        navigator.vibrate?.(25);
      }

      const before = rankFor((baseXp.current ?? 0) + gameXpRef.current);
      gameXpRef.current += gained;
      setGameXp(gameXpRef.current);
      const after = rankFor((baseXp.current ?? 0) + gameXpRef.current);
      if (after.label !== before.label && userRef.current) {
        setRankUp({ label: after.label, tier: after.tier.id, division: after.division });
        if (soundRef.current) [660, 880, 1320].forEach((f, i) => setTimeout(() => beep(f, 0.15), i * 120));
      }

      const key = `${ex}-${m}`;
      sessionXp.current[key] = (sessionXp.current[key] ?? 0) + gained;
      bestComboRef.current[key] = Math.max(bestComboRef.current[key] ?? 0, newCombo);
      if (m === "challenge60") challengeXp.current += gained;
      syncFor(ex, m)?.push({ reps: count, xp: sessionXp.current[key] ?? 0, best_combo: bestComboRef.current[key] ?? 0 });
    },
    [syncFor],
  );

  const onLandmarks = useCallback(
    (lms: Landmark[] | null, aspect: number) => {
      const ex = exRef.current;
      if (!lms) {
        smooth.current = { angle: null, height: null };
        setLive((l) => ({ ...l, tracking: false, angle: null }));
        return;
      }
      const m = computeMetrics(lms, ex, aspect);
      const now = performance.now();
      const countingAllowed = modeRef.current === "free" || challengeRef.current.state === "running";

      if (m.angle !== null) {
        const sm = smooth.current;
        // drop single-frame glitches
        if (sm.angle !== null && Math.abs(m.angle - sm.angle) > 70) return;
        sm.angle = sm.angle === null ? m.angle : sm.angle * 0.55 + m.angle * 0.45;
        sm.height = sm.height === null ? m.height : sm.height * 0.55 + m.height * 0.45;
        if (countingAllowed) {
          const { state, event } = step(
            counters.current[ex],
            { angle: sm.angle, height: sm.height, inPose: m.inPose, t: now },
            THRESHOLDS[ex],
          );
          counters.current[ex] = state;
          if (event) handleEvent(ex, event, state.count);
        }
      }

      if (now - lastUi.current > 90) {
        lastUi.current = now;
        const s = counters.current[ex];
        setLive({ angle: smooth.current.angle, tracking: true, issue: m.issue, bodyVisible: m.bodyVisible, phase: s.phase, armed: s.armed });
      }
      // gentle reminder when the user leaves the pose mid-session
      if (m.issue === "pose" && counters.current[ex].count > 0 && now - lastPoseWarn.current > 8000 && countingAllowed) {
        lastPoseWarn.current = now;
      }
    },
    [handleEvent],
  );

  // Challenge timer
  useEffect(() => {
    if (challenge.state === "countdown") {
      if (challenge.countdown <= 0) {
        setChallenge({ state: "running", countdown: 0, endsAt: performance.now() + CHALLENGE_MS });
        if (soundRef.current) beep(1200, 0.25);
        return;
      }
      if (soundRef.current) beep(600, 0.1);
      const t = setTimeout(() => setChallenge((c) => ({ ...c, countdown: c.countdown - 1 })), 1000);
      return () => clearTimeout(t);
    }
    if (challenge.state === "running") {
      const iv = setInterval(() => {
        const left = Math.max(0, challenge.endsAt - performance.now());
        setTimeLeft(left);
        if (left <= 0) {
          clearInterval(iv);
          finishChallenge();
        }
      }, 100);
      return () => clearInterval(iv);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge]);

  const startChallenge = () => {
    if (!running) {
      toast("Önce kamerayı başlat");
      return;
    }
    const ex = exRef.current;
    counters.current[ex] = initialState();
    smooth.current = { angle: null, height: null };
    comboRef.current = 0;
    challengeXp.current = 0;
    setCombo(0);
    setCounts((c) => ({ ...c, [ex]: 0 }));
    // fresh cloud session for each attempt
    const key = `${ex}-challenge60`;
    void syncs.current[key]?.flush();
    delete syncs.current[key];
    sessionXp.current[key] = 0;
    bestComboRef.current[key] = 0;
    syncFor(ex, "challenge60")?.start();
    setTimeLeft(CHALLENGE_MS);
    setChallenge({ state: "countdown", countdown: 3, endsAt: 0 });
  };

  const finishChallenge = () => {
    const ex = exRef.current;
    const score = counters.current[ex].count;
    void syncs.current[`${ex}-challenge60`]?.flush();
    setChallenge({ state: "idle", countdown: 0, endsAt: 0 });
    const prevBest = ex === "pushup" ? (profile.data?.best60_pushup ?? 0) : (profile.data?.best60_pullup ?? 0);
    const localBest = Number(localStorage.getItem(`best60-${ex}`) ?? 0);
    const best = Math.max(prevBest, localBest);
    if (score > localBest) localStorage.setItem(`best60-${ex}`, String(score));
    setResult({ exercise: ex, score, best, isRecord: score > best && score > 0, xp: challengeXp.current });
    if (soundRef.current) [880, 660, 990].forEach((f, i) => setTimeout(() => beep(f, 0.18), i * 150));
    setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["my-profile"] }), 1500);
  };

  const cancelChallenge = () => {
    setChallenge({ state: "idle", countdown: 0, endsAt: 0 });
    setTimeLeft(CHALLENGE_MS);
  };

  const select = (ex: Exercise) => {
    if (challenge.state !== "idle") return;
    setExercise(ex);
    smooth.current = { angle: null, height: null };
    counters.current[ex] = { ...initialState(), count: counters.current[ex].count };
    comboRef.current = 0;
    setCombo(0);
  };

  const reset = (ex: Exercise) => {
    const key = `${ex}-${modeRef.current}`;
    void syncs.current[key]?.flush();
    delete syncs.current[key];
    sessionXp.current[key] = 0;
    bestComboRef.current[key] = 0;
    counters.current[ex] = initialState();
    setCounts((c) => ({ ...c, [ex]: 0 }));
  };

  const switchMode = (m: Mode) => {
    if (challenge.state !== "idle" || m === mode) return;
    Object.values(syncs.current).forEach((s) => void s.flush());
    setMode(m);
    counters.current = { pushup: initialState(), pullup: initialState() };
    setCounts({ pushup: 0, pullup: 0 });
    comboRef.current = 0;
    setCombo(0);
  };

  const locked = challenge.state !== "idle";

  return (
    <main className="mx-auto flex max-w-6xl animate-page-in flex-col gap-4 px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
      {/* Player strip */}
      <section className="surface-glass flex items-center gap-3 rounded-2xl p-3 sm:p-4">
        <RankBadge tier={rank.tier.id} division={rank.division} size={52} glow={rank.tierIndex >= 4} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-stencil truncate text-xl text-bone">
              {user ? (profile.data?.username ?? "…") : "Misafir"} <span className="text-muted-foreground">· {rank.label}</span>
            </p>
            <p className="shrink-0 font-mono text-xs text-muted-foreground">{totalXp.toLocaleString("tr-TR")} XP</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full animate-shimmer rounded-full bg-[linear-gradient(90deg,var(--ember),var(--warn),var(--ember))] transition-[width] duration-500"
              style={{ width: `${Math.round(rank.progress * 100)}%` }}
            />
          </div>
          {!user && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              XP'n kaydedilsin ve sıralamaya gir:{" "}
              <Link to="/auth" className="font-semibold text-ember underline-offset-2 hover:underline">
                Giriş yap
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* Mode switch */}
      <section className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-2 rounded-xl border border-border bg-surface p-1">
          {(["free", "challenge60"] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              disabled={locked}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all ${
                mode === m ? "bg-surface-raised text-bone shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "free" ? <Zap className="size-4" /> : <Timer className="size-4" />}
              {m === "free" ? "Serbest" : "60 sn Meydan Okuma"}
            </button>
          ))}
        </div>
        <Button variant="outline" size="icon" onClick={() => setSound((s) => !s)} aria-label={sound ? "Sesi kapat" : "Sesi aç"}>
          {sound ? <Volume2 /> : <VolumeX />}
        </Button>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <div className="flex flex-col gap-3">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-1" aria-label="Egzersizler">
            {(["pushup", "pullup"] as const).map((ex) => (
              <CountBox
                key={ex}
                exercise={ex}
                count={counts[ex]}
                active={exercise === ex}
                pop={pop?.ex === ex ? pop : null}
                onSelect={() => select(ex)}
                onReset={() => reset(ex)}
                disabled={locked}
              />
            ))}
          </section>

          {mode === "challenge60" && (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-stencil text-lg text-bone">60 saniyede kaç {LABELS[exercise].toLowerCase()}?</p>
              <p className="mt-1 text-sm text-muted-foreground">Geri sayımdan sonra süre başlar. Sadece süre içindeki tekrarlar sayılır.</p>
              {challenge.state === "idle" ? (
                <Button variant="ember" size="lg" className="mt-3 w-full" onClick={startChallenge}>
                  <Timer /> Meydan okumayı başlat
                </Button>
              ) : (
                <Button variant="outline" size="lg" className="mt-3 w-full" onClick={cancelChallenge}>
                  Vazgeç
                </Button>
              )}
            </section>
          )}
        </div>

        <PoseCamera onLandmarks={onLandmarks} onRunningChange={setRunning}>
          <Hud exercise={exercise} live={live} combo={combo} />
          <Banner banner={banner} />
          {challenge.state === "countdown" && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-scrim">
              <span key={challenge.countdown} className="text-stencil animate-rep-pop text-[9rem] text-bone">
                {challenge.countdown > 0 ? challenge.countdown : "Başla!"}
              </span>
            </div>
          )}
          {challenge.state === "running" && (
            <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-scrim px-4 py-1.5 backdrop-blur-md">
              <span className={`text-stencil text-3xl tabular-nums ${timeLeft < 10_000 ? "text-destructive" : "text-bone"}`}>
                {Math.ceil(timeLeft / 1000)}
              </span>
            </div>
          )}
        </PoseCamera>
      </div>

      <RankUpOverlay rank={rankUp} onClose={() => setRankUp(null)} />
      <ChallengeResult
        result={result}
        onClose={() => setResult(null)}
        onRetry={() => {
          setResult(null);
          startChallenge();
        }}
      />
    </main>
  );
}

function Hud({ exercise, live, combo }: { exercise: Exercise; live: Live; combo: number }) {
  const t = THRESHOLDS[exercise];
  const isPush = exercise === "pushup";
  const bar = isPush ? "bg-ember" : "bg-volt";
  const span = t.top + 15 - t.bottom;
  const depth = live.angle === null ? 0 : Math.max(0, Math.min(1, (t.top + 15 - live.angle) / span));
  const halfMark = (t.top + 15 - t.half) / span;

  let hint: string;
  if (!live.tracking) hint = "Vücut aranıyor…";
  else if (live.angle === null) hint = "Kolların görünmüyor";
  else if (live.issue === "pose") hint = isPush ? "Şınav pozisyonu al" : "Bara asıl";
  else if (!live.armed) hint = isPush ? "Kolları düz aç" : "Kolları tam aç";
  else if (live.phase === "up") hint = isPush ? "İn" : "Çek";
  else if (live.phase === "descending") hint = isPush ? "Daha aşağı" : "Daha yukarı";
  else hint = isPush ? "Yukarı it" : "Kontrollü in";

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-ember/10 to-transparent" />
      <div className="absolute left-3 top-3 flex flex-col items-start gap-2">
        <span className="rounded-md bg-scrim px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest text-bone backdrop-blur-md">
          {LABELS[exercise]} · {live.angle === null ? "--" : `${Math.round(live.angle)}°`}
        </span>
        {combo >= 2 && (
          <span key={combo} className="animate-rep-pop flex items-center gap-1 rounded-md bg-ember px-2.5 py-1 text-stencil text-lg text-ember-foreground">
            <Flame className="size-4" /> {combo}x combo
          </span>
        )}
      </div>

      <div className="absolute inset-x-3 bottom-3 rounded-xl bg-scrim p-3 backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-stencil text-xl text-bone sm:text-2xl">{hint}</span>
          {live.tracking && !live.bodyVisible ? (
            <span className="text-right text-[11px] font-medium text-warn">Baş ve bacaklar kadrajda olsun</span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Hareket aralığı</span>
          )}
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
