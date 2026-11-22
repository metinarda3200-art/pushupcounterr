import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gamepad2, Home, ListOrdered, LogIn, LogOut, Medal, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { rankFor } from "@/lib/game";
import { myProfileQuery } from "@/lib/queries";
import { RankBadge } from "@/components/game/RankBadge";

const LINKS = [
  { to: "/", label: "Ana Sayfa", icon: Home },
  { to: "/oyun", label: "Oyun", icon: Gamepad2 },
  { to: "/rank", label: "Rank", icon: Medal },
  { to: "/siralama", label: "Sıralama", icon: ListOrdered },
  { to: "/form", label: "Form", icon: PlayCircle },
] as const;

function AccountButton() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useQuery({ ...myProfileQuery(user?.id ?? ""), enabled: !!user });

  if (loading) return <div className="size-9" />;
  if (!user) {
    return (
      <Button asChild variant="ember" size="sm">
        <Link to="/auth">
          <LogIn /> Giriş
        </Link>
      </Button>
    );
  }
  const rank = rankFor(profile.data?.xp ?? 0);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-sm transition-colors hover:bg-surface-raised">
          <RankBadge tier={rank.tier.id} size={28} />
          <span className="max-w-24 truncate font-medium">{profile.data?.username ?? "…"}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate">{profile.data?.username}</p>
          <p className="text-xs font-normal text-muted-foreground">
            {rank.label} · {(profile.data?.xp ?? 0).toLocaleString("tr-TR")} XP
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/rank">Rankım</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={signOut}>
          <LogOut /> Çıkış yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteNav() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="group flex items-center gap-2">
            <span className="relative flex size-7 items-center justify-center rounded-md bg-ember">
              <span className="size-2 rounded-full bg-ember-foreground transition-transform group-hover:scale-150" />
            </span>
            <span className="text-stencil text-2xl text-bone">Tekrar</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Ana menü">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeOptions={{ exact: l.to === "/" }}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[status=active]:bg-surface-raised data-[status=active]:text-bone"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <AccountButton />
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Alt menü"
      >
        <div className="grid grid-cols-5">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: l.to === "/" }}
              className="group flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors data-[status=active]:text-ember"
            >
              <l.icon className="size-5 transition-transform group-data-[status=active]:-translate-y-0.5 group-data-[status=active]:scale-110" />
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
