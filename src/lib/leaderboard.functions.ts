import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

export const METRICS = ["xp", "pushup60", "pullup60"] as const;
export type Metric = (typeof METRICS)[number];

export type LeaderRow = {
  id: string;
  username: string;
  xp: number;
  pushups: number;
  pullups: number;
  best_combo: number;
  best60_pushup: number;
  best60_pullup: number;
};

const COLUMN: Record<Metric, "xp" | "best60_pushup" | "best60_pullup"> = {
  xp: "xp",
  pushup60: "best60_pushup",
  pullup60: "best60_pullup",
};

/** Public leaderboard read (no sign-in needed): publishable key + public SELECT policy. */
export const getLeaderboard = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ metric: z.enum(METRICS) }).parse(d))
  .handler(async ({ data }): Promise<LeaderRow[]> => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Backend is not configured");
    const client = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });
    const col = COLUMN[data.metric];
    let q = client
      .from("profiles")
      .select("id, username, xp, pushups, pullups, best_combo, best60_pushup, best60_pullup")
      .order(col, { ascending: false })
      .order("created_at", { ascending: true })
      .limit(50);
    if (data.metric !== "xp") q = q.gt(col, 0);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      ...r,
      pushups: Number(r.pushups),
      pullups: Number(r.pullups),
      best60_pushup: Number(r.best60_pushup),
      best60_pullup: Number(r.best60_pullup),
    }));
  });
