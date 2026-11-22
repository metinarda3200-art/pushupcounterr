-- Player profiles: public leaderboard data (stats are maintained by triggers, only username is user-editable)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  xp integer NOT NULL DEFAULT 0,
  pushups numeric(8,1) NOT NULL DEFAULT 0,
  pullups numeric(8,1) NOT NULL DEFAULT 0,
  best_combo integer NOT NULL DEFAULT 0,
  best60_pushup numeric(6,1) NOT NULL DEFAULT 0,
  best60_pullup numeric(6,1) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT username_format CHECK (char_length(username) BETWEEN 3 AND 20 AND username ~ '^[A-Za-z0-9_çğıöşüÇĞİÖŞÜ.]+$')
);

GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT UPDATE (username) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leaderboard is public" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Users rename themselves" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Workout sessions: each row is one counting session of one exercise
CREATE TABLE public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  exercise text NOT NULL CHECK (exercise IN ('pushup','pullup')),
  mode text NOT NULL DEFAULT 'free' CHECK (mode IN ('free','challenge60')),
  reps numeric(6,1) NOT NULL DEFAULT 0 CHECK (reps >= 0 AND reps <= 1000),
  xp integer NOT NULL DEFAULT 0 CHECK (xp >= 0 AND xp <= 60000),
  best_combo integer NOT NULL DEFAULT 0 CHECK (best_combo >= 0 AND best_combo <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.workout_sessions TO authenticated;
GRANT ALL ON public.workout_sessions TO service_role;

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own sessions" ON public.workout_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own sessions" ON public.workout_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions" ON public.workout_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX workout_sessions_user_idx ON public.workout_sessions(user_id);

-- Plausibility guard: no more than ~2 reps per second since the session started, fixed identity columns
CREATE OR REPLACE FUNCTION public.validate_workout_session()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  elapsed numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    IF NEW.reps > 2 THEN RAISE EXCEPTION 'Session must start near zero reps'; END IF;
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.exercise := OLD.exercise;
    NEW.mode := OLD.mode;
    NEW.created_at := OLD.created_at;
    IF NEW.reps < OLD.reps OR NEW.xp < OLD.xp THEN RAISE EXCEPTION 'Session totals cannot decrease'; END IF;
  END IF;
  elapsed := EXTRACT(EPOCH FROM (now() - NEW.created_at));
  IF NEW.reps > elapsed * 2 + 2 THEN RAISE EXCEPTION 'Too many reps for elapsed time'; END IF;
  IF NEW.mode = 'challenge60' AND elapsed > 120 AND TG_OP = 'UPDATE' AND NEW.reps <> OLD.reps THEN
    RAISE EXCEPTION 'Challenge already finished';
  END IF;
  IF NEW.xp > NEW.reps * 60 + 60 THEN RAISE EXCEPTION 'XP too high for reps'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER workout_sessions_validate
BEFORE INSERT OR UPDATE ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_workout_session();

-- Keep profile totals in sync with sessions
CREATE OR REPLACE FUNCTION public.refresh_profile_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles p SET
    xp = s.xp,
    pushups = s.pushups,
    pullups = s.pullups,
    best_combo = s.best_combo,
    best60_pushup = s.best60_pushup,
    best60_pullup = s.best60_pullup,
    updated_at = now()
  FROM (
    SELECT
      COALESCE(SUM(xp), 0)::int AS xp,
      COALESCE(SUM(reps) FILTER (WHERE exercise = 'pushup'), 0) AS pushups,
      COALESCE(SUM(reps) FILTER (WHERE exercise = 'pullup'), 0) AS pullups,
      COALESCE(MAX(best_combo), 0) AS best_combo,
      COALESCE(MAX(reps) FILTER (WHERE exercise = 'pushup' AND mode = 'challenge60'), 0) AS best60_pushup,
      COALESCE(MAX(reps) FILTER (WHERE exercise = 'pullup' AND mode = 'challenge60'), 0) AS best60_pullup
    FROM public.workout_sessions WHERE user_id = NEW.user_id
  ) s
  WHERE p.id = NEW.user_id;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_profile_stats() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER workout_sessions_refresh_profile
AFTER INSERT OR UPDATE ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.refresh_profile_stats();

-- Create a profile for every new account, with a unique username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  base := COALESCE(NULLIF(NEW.raw_user_meta_data->>'username', ''), split_part(COALESCE(NEW.email, 'sporcu'), '@', 1));
  base := regexp_replace(base, '[^A-Za-z0-9_]', '', 'g');
  IF char_length(base) < 3 THEN base := 'sporcu' || base; END IF;
  base := left(base, 15);
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(candidate)) LOOP
    n := n + 1;
    candidate := base || floor(random() * 9000 + 1000)::int::text;
    IF n > 20 THEN candidate := 'sporcu' || substr(md5(NEW.id::text), 1, 8); EXIT; END IF;
  END LOOP;
  INSERT INTO public.profiles (id, username) VALUES (NEW.id, candidate);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE UNIQUE INDEX profiles_username_lower_idx ON public.profiles (lower(username));
CREATE INDEX profiles_xp_idx ON public.profiles (xp DESC);