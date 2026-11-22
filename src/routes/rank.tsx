import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { RankBadge } from "@/components/game/RankBadge";
import { useAuth } from "@/lib/auth-context";
import { BASE_XP, TIERS, rankFor } from "@/lib/game";
import { myProfileQuery } from "@/lib/queries";
import { formatCount } from "@/lib/rep-counter";

export const Route = createFileRoute("/rank")({
  head: () => ({
    meta: [
      { title: "Rank Sistemi — Bronz, Gümüş, Altın, Platin, Elmas | Tekrar" },
      { name: "description", content: "Şınav ve barfiksle XP kazan, Bronzdan Şampiyona yüksel. Rankını ve bir sonraki kademeye kalan XP'yi gör." },
      { property: "og:title", content: "Rank Sistemi — Bronzdan Şampiyona" },
      { property: "og:description", content: "XP kazan, kademe atla, Elmas ol." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RankPage,
});

function RankPage() {
  const { user } = useAuth();
  const profile = useQuery({ ...myProfileQuery(user?.id ?? ""), enabled: !!user });
  const xp = profile.data?.xp ?? 0;
  const rank = rankFor(xp);

  return (
    <main className="mx-auto max-w-4xl animate-page-in px-4 py-8 sm:px-6">
      <section className="surface-glass flex flex-col items-center rounded-3xl p-8 text-center">
        <RankBadge tier={rank.tier.id} division={rank.division} size={150} glow />
        <h1 className="text-stencil mt-4 text-5xl text-bone">{user ? rank.label : "Rankın"}</h1>
        {user ? (
          <>
            <p className="mt-1 text-muted-foreground">{profile.data?.username} · {xp.toLocaleString("tr-TR")} XP</p>
            <div className="mt-5 h-3 w-full max-w-sm overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full animate-shimmer bg-[linear-gradient(90deg,var(--ember),var(--warn),var(--ember))]" style={{ width: `${Math.round(rank.progress * 100)}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {rank.next ? `Sonraki kademeye ${(rank.next - xp).toLocaleString("tr-TR")} XP` : "Zirvedesin!"}
            </p>
            <div className="mt-6 grid w-full max-w-md grid-cols-3 gap-3 text-center">
              <Stat label="Şınav" value={formatCount(profile.data?.pushups ?? 0)} />
              <Stat label="Barfiks" value={formatCount(profile.data?.pullups ?? 0)} />
              <Stat label="En iyi combo" value={String(profile.data?.best_combo ?? 0)} />
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-muted-foreground">Rankını kaydetmek için giriş yap.</p>
            <Button asChild variant="ember" className="mt-4"><Link to="/auth">Giriş yap</Link></Button>
          </>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-stencil text-3xl text-bone">Kademeler</h2>
        {TIERS.map((t, i) => {
          const current = user && t.id === rank.tier.id;
          return (
            <div key={t.id} className={`flex items-center gap-4 rounded-2xl border bg-surface p-4 ${current ? "border-ember" : "border-border"}`}>
              <RankBadge tier={t.id} size={56} glow={i >= 4} />
              <div className="flex-1">
                <p className="text-stencil text-2xl text-bone">{t.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{t.min.toLocaleString("tr-TR")} XP{t.id !== "sampiyon" ? " · III, II, I kademeleri" : ""}</p>
              </div>
              {current && <span className="font-mono text-xs uppercase text-ember">Buradasın</span>}
            </div>
          );
        })}
        <p className="pt-2 text-sm text-muted-foreground">
          Tam şınav {BASE_XP.pushup} XP, tam barfiks {BASE_XP.pullup} XP. Yarım tekrar yarısını verir. Art arda tam tekrarlar combo ile %100'e kadar bonus kazandırır.
        </p>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-stencil text-3xl text-bone">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
