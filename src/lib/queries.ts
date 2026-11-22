import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getLeaderboard, type Metric } from "./leaderboard.functions";

export const leaderboardQuery = (metric: Metric) =>
  queryOptions({
    queryKey: ["leaderboard", metric],
    queryFn: () => getLeaderboard({ data: { metric } }),
    staleTime: 15_000,
  });

export type MyProfile = {
  id: string;
  username: string;
  xp: number;
  pushups: number;
  pullups: number;
  best_combo: number;
  best60_pushup: number;
  best60_pullup: number;
};

/** Signed-in user's own profile; runs in the browser where the session lives. */
export const myProfileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["my-profile", userId],
    queryFn: async (): Promise<MyProfile> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, xp, pushups, pullups, best_combo, best60_pushup, best60_pullup")
        .eq("id", userId)
        .single();
      if (error) throw new Error(error.message);
      return {
        ...data,
        pushups: Number(data.pushups),
        pullups: Number(data.pullups),
        best60_pushup: Number(data.best60_pushup),
        best60_pullup: Number(data.best60_pullup),
      };
    },
  });
