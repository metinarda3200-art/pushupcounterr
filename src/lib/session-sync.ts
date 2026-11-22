import { supabase } from "@/integrations/supabase/client";
import type { Exercise } from "./rep-counter";

export type SessionTotals = { reps: number; xp: number; best_combo: number };
type Mode = "free" | "challenge60";

/**
 * Saves one counting session to the cloud: creates the row on first use, then sends the
 * latest totals at most every ~1.2 s.
 */
export class SessionSync {
  private id: string | null = null;
  private creating: Promise<string | null> | null = null;
  private pending: SessionTotals | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onError: (msg: string) => void;

  constructor(
    private exercise: Exercise,
    private mode: Mode,
    onError: (msg: string) => void,
  ) {
    this.onError = onError;
  }

  /** Create the row now (call when the session starts, e.g. a challenge countdown). */
  start() {
    void this.ensureRow();
  }

  push(totals: SessionTotals) {
    this.pending = totals;
    if (!this.timer) this.timer = setTimeout(() => void this.flush(), 1200);
  }

  async flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const totals = this.pending;
    if (!totals) return;
    this.pending = null;
    const id = await this.ensureRow();
    if (!id) return;
    const { error } = await supabase.from("workout_sessions").update(totals).eq("id", id);
    if (error) this.onError(error.message);
  }

  private ensureRow(): Promise<string | null> {
    if (this.id) return Promise.resolve(this.id);
    if (!this.creating) {
      this.creating = (async () => {
        const { data, error } = await supabase
          .from("workout_sessions")
          .insert({ exercise: this.exercise, mode: this.mode })
          .select("id")
          .single();
        if (error) {
          this.onError(error.message);
          this.creating = null;
          return null;
        }
        this.id = data.id;
        return data.id;
      })();
    }
    return this.creating;
  }
}
