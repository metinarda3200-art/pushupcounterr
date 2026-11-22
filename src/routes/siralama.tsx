import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

import { RankBadge } from "@/components/game/RankBadge";
import { useAuth } from "@/lib/auth-context";
import { rankFor } from "@/lib/game";
import { leaderboardQuery } from "@/lib/queries";
import type { Metric } from "@/lib/leaderboard.functions";
import { formatCount } from "@/lib/rep-counter";

export const Route = createFileRoute("/siralama")({
  head: () => ({
    meta: [
      { title: "Sıralama — En Çok Şınav ve Barfiks Çekenler | Tekrar" },
      { name: "description", content: "Dünya sıralaması: toplam XP, 60 saniyede en çok şınav ve barfiks rekorları." },
      { property: "og:title", content: "Sıralama — En Çok Şınav ve Barfiks Çekenler" },
      { property: "og:description", content: "Toplam XP ve 60 saniye rekorlarında zirvedekiler." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(leaderboardQuery("xp")),
  component: LeaderboardPage,
});

const TABS: { id: Metric; label: string }[] = [
  { id: "xp", label: "Toplam XP" },
  { id: "pushup60", label: "60 sn Şınav" },
  { id: "pullup60", label: "60 sn Barfiks" },
];

function LeaderboardPage() {
  const [metric, setMetric] = useState<Metric>("xp");
  return (
    <main className="mx-auto max-w-3xl animate-page-in px-4 py-8 sm:px-6">
      <h1 className="text-stencil text-5xl text-bone">Sıralama</h1>
      <div className="mt-5 grid grid-cols-3 rounded-xl border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setMetric(t.id)} className={`rounded-lg py-2 text-xs font-semibold sm:text-sm ${metric === t.id ? "bg-surface-raised text-bone" : "text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <Board metric={metric} />
    </main>
  );
}

function Board({ metric }: { metric: Metric }) {
  const { user } = useAuth();
  const { data } = useSuspenseQuery(leaderboardQuery(metric));
  if (!data.length) return <p className="mt-10 text-center text-muted-foreground">Henüz kimse yok. İlk sen ol!</p>;
  return (
    <ol className="mt-5 space-y-2">
      {data.map((r, i) => {
        const rank = rankFor(r.xp);
        const value = metric === "xp" ? `${r.xp.toLocaleString("tr-TR")} XP` : formatCount(metric === "pushup60" ? r.best60_pushup : r.best60_pullup);
        return (
          <li key={r.id} className={`animate-page-in flex items-center gap-3 rounded-2xl border bg-surface p-3 ${r.id === user?.id ? "border-ember" : "border-border"}`} style={{ animationDelay: `${i * 40}ms` }}>
            <span className={`text-stencil w-8 text-center text-2xl ${i < 3 ? "text-warn" : "text-muted-foreground"}`}>{i + 1}</span>
            <RankBadge tier={rank.tier.id} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-bone">{r.username}</p>
              <p className="text-xs text-muted-foreground">{rank.label}</p>
            </div>
            <span className="text-stencil text-xl text-bone">{value}</span>
          </li>
        );
      })}
    </ol>
  );
}
