import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Giriş Yap — Tekrar" },
      { name: "description", content: "Giriş yap, XP'n kaydedilsin ve dünya sıralamasına gir." },
      { property: "og:title", content: "Giriş Yap — Tekrar" },
      { property: "og:description", content: "XP'ni kaydet, sıralamaya gir." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/oyun", replace: true });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("Giriş başarısız: e-posta veya şifre hatalı");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { username } },
      });
      if (error) toast.error(error.message);
      else toast.success("E-postana gelen bağlantıyla hesabını onayla");
    }
    setBusy(false);
  };

  const social = async (provider: "google" | "lovable") => {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) toast.error("Giriş yapılamadı");
  };

  return (
    <main className="mx-auto max-w-sm animate-page-in px-4 py-12">
      <h1 className="text-stencil text-5xl text-bone">{mode === "in" ? "Giriş yap" : "Kayıt ol"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">XP'n kaydedilsin, rank atla ve sıralamaya gir.</p>
      <div className="mt-6 space-y-2">
        <Button type="button" variant="outline" className="w-full" onClick={() => social("google")}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
          Google ile devam et
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={() => social("lovable")}>
          <LovableMark /> Lovable ile devam et
        </Button>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-3">
        {mode === "up" && (
          <Input placeholder="Kullanıcı adı" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={20} required />
        )}
        <Input type="email" placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        <Button type="submit" variant="ember" className="w-full" disabled={busy}>
          {mode === "in" ? "Giriş yap" : "Kayıt ol"}
        </Button>
      </form>
      <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 text-sm text-muted-foreground hover:text-foreground">
        {mode === "in" ? "Hesabın yok mu? Kayıt ol" : "Hesabın var mı? Giriş yap"}
      </button>
    </main>
  );
}
