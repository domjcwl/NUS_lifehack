export type BearMood = "thriving" | "happy" | "worried" | "fading";

export interface Action {
  id: string;
  userId: string;
  at: number;
  binId: string | null;
  item: string;
  verified: boolean;
  confidence: number;
  reason: string;
}

export interface User {
  id: string;
  name: string;
  floor: string;
  /** Self-reported actions/week at signup — the baseline for measurement. */
  baselineWeekly: number;
  /** Study arm: "bear" gets the full mechanic, "control" gets logging only. */
  arm: "bear" | "control";
  joinedAt: number;
}

export interface ScanInstance {
  id: string;
  binId: string;
  createdAt: number;
  usedBy: string | null;
}

export interface Bin {
  id: string;
  name: string;
  block: string;
  lat: number;
  lng: number;
  streams: string[];
}

/** The shape the client needs for the signed-in (or guest) identity. */
export interface Me {
  id: string;
  username: string | null;
  displayName: string;
  isGuest: boolean;
}
