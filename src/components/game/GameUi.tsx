import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, Trophy, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RankBadge } from "@/components/game/RankBadge";
import type { TierId } from "@/lib/game";
import { formatCount, type Exercise } from "@/lib/rep-counter";

export const LABELS: Record<Exercise, string> = { pushup: "Şınav", pullup: "Barfiks" };

export function CountBox({
  exercise,
  count,
  active,
  pop,
  onSelect,
  onReset,
  disabled,
}: {
  exercise: Exercise;
  count: number;
  active: boolean;
  pop: { text: string; id: number } | null;
  onSelect: () => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  const isPush = exercise === "pushup";
  const tone = isPush ? "text-ember" : "text-volt";
  const ring = isPush
    ? "border-ember shadow-[0_0_0_1px_var(--ember),0_20px_60px_-25px_var(--ember)]"
    : "border-volt shadow-[0_0_0_1px_var(--volt),0_20px_60px_-25px_var(--volt)]";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && onSelect()}
      onKeyDown={(e) => !disabled && (e.key === "Enter" || e.key === " ") && onSelect()}
      aria-pressed={active}
      aria-label={`${LABELS[exercise]} sayacı`}
      className={`relative overflow-hidden rounded-2xl border bg-surface p-4 text-left transition-all duration-300 sm:p-5 ${
        active ? ring : "border-border opacity-60 hover:opacity-100"
      } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-stencil text-xl sm:text-2xl ${active ? tone : "text-muted-foreground"}`}>
          {LABELS[exercise]}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {active && <span className={`size-1.5 animate-blink rounded-full ${isPush ? "bg-ember" : "bg-volt"}`} />}
          {active ? "Aktif" : "Seç"}
        </span>
      </div>
      <div className="relative mt-2 flex items-baseline gap-2">
        <span
          key={pop?.id ?? "static"}
          className={`text-stencil text-6xl tabular-nums text-bone sm:text-8xl ${pop ? "animate-rep-pop" : ""}`}
          data-testid={`count-${exercise}`}
        >
          {formatCount(count)}
        </span>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">tekrar</span>
        {pop && (
          <span key={`p-${pop.id}`} className={`text-stencil animate-float-up absolute -top-1 right-0 text-xl ${tone}`}>
            {pop.text}
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mt-1 text-muted-foreground"
        disabled={disabled}
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

export type BannerKind = "half" | "shallow" | "pose";

export function Banner({ banner }: { banner: { kind: BannerKind; title: string; sub: string; id: number } | null }) {
  if (!banner) return null;
  const tone =
    banner.kind === "half"
      ? "bg-warn text-warn-foreground"
      : banner.kind === "shallow"
        ? "bg-destructive text-destructive-foreground"
        : "bg-surface-raised text-bone";
  return (
    <div key={banner.id} className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center px-4">
      <div className={`animate-banner rounded-xl px-5 py-3 text-center shadow-2xl ${tone}`} role="status" aria-live="assertive">
        <p className="text-stencil text-3xl sm:text-4xl">{banner.title}</p>
        <p className="mt-1 text-sm font-semibold">{banner.sub}</p>
      </div>
    </div>
  );
}

export function RankUpOverlay({
  rank,
  onClose,
}: {
  rank: { label: string; tier: TierId; division: string | null } | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {rank && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative flex flex-col items-center text-center"
            initial={{ scale: 0.4, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 14 }}
          >
            <motion.div
              className="absolute -inset-16 rounded-full bg-[conic-gradient(from_0deg,transparent,var(--ember),transparent,var(--warn),transparent)] opacity-40 blur-2xl"
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />
            <p className="relative font-mono text-xs uppercase tracking-[0.3em] text-warn">Rank atladın</p>
            <RankBadge tier={rank.tier} division={rank.division} size={180} glow className="relative my-4" />
            <p className="text-stencil relative text-5xl text-bone">{rank.label}</p>
            <Button variant="ember" size="lg" className="relative mt-6" onClick={onClose}>
              Devam et
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ChallengeResult({
  result,
  onClose,
  onRetry,
}: {
  result: { exercise: Exercise; score: number; best: number; isRecord: boolean; xp: number } | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <AnimatePresence>
      {result && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-sm rounded-3xl border border-border bg-surface p-6 text-center"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <button onClick={onClose} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground" aria-label="Kapat">
              <X className="size-5" />
            </button>
            <Trophy className="mx-auto size-10 text-warn" />
            <p className="mt-2 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
              60 sn {LABELS[result.exercise]}
            </p>
            <motion.p
              className="text-stencil mt-2 text-8xl text-bone"
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.15 }}
            >
              {formatCount(result.score)}
            </motion.p>
            <p className="text-sm text-muted-foreground">tekrar · +{result.xp} XP</p>
            {result.isRecord ? (
              <p className="text-stencil mt-4 animate-shimmer bg-[linear-gradient(90deg,var(--warn),var(--bone),var(--warn))] bg-clip-text text-2xl text-transparent">
                Yeni rekor!
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Rekorun: {formatCount(result.best)}</p>
            )}
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={onClose}>
                Kapat
              </Button>
              <Button variant="ember" onClick={onRetry}>
                Tekrar dene
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
