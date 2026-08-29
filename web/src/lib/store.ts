import type { Action, Bin, ScanInstance, User } from "./types";

const DAY = 86_400_000;

/**
 * In-memory store. Deliberate: a 24-hour prototype should not fail its demo
 * because a database connection dropped. Swap for Postgres if this ships.
 */
type DB = {
  users: Map<string, User>;
  actions: Action[];
  instances: Map<string, ScanInstance>;
};

const g = globalThis as unknown as { __ecodb?: DB };

/**
 * Scan anchors. These are real blue-bin locations from NEA's dataset — the demo
 * point is a block you can actually stand at, not an invented one.
 */
export const BINS: Bin[] = [
  { id: "tpe-826a", name: "Blk 826A Tampines Street 81", block: "Tampines", lat: 1.34919, lng: 103.93409, streams: ["plastic", "paper", "metal", "glass"] },
  { id: "sk-407", name: "Blk 407 Fernvale Road", block: "Sengkang", lat: 1.38854, lng: 103.87505, streams: ["plastic", "paper", "metal"] },
  { id: "rh-76", name: "Blk 76 Redhill Road", block: "Bukit Merah", lat: 1.28864, lng: 103.81634, streams: ["plastic", "paper", "metal"] },
  { id: "wl-897e", name: "Blk 897E Woodlands Drive 50", block: "Woodlands", lat: 1.43566, lng: 103.79471, streams: ["plastic", "paper"] },
  { id: "pg-110", name: "Blk 110 Punggol Field", block: "Punggol", lat: 1.39897, lng: 103.9111, streams: ["plastic", "paper", "metal"] },
];

function seed(): DB {
  const users = new Map<string, User>();
  const actions: Action[] = [];
  const now = Date.now();

  const demo: User = {
    id: "demo",
    name: "You",
    floor: "Blk 826A Tampines St 81",
    baselineWeekly: 2,
    arm: "bear",
    joinedAt: now - 12 * DAY,
  };
  users.set(demo.id, demo);

  // A short prior history so the demo opens on a live streak rather than zero.
  const priors = [1, 2, 3, 5, 6, 8, 9, 11];
  priors.forEach((daysAgo, i) => {
    actions.push({
      id: `seed-${i}`,
      userId: "demo",
      at: now - daysAgo * DAY + 3_600_000,
      binId: BINS[i % BINS.length].id,
      item: ["plastic bottle", "aluminium can", "paper cup sleeve", "cardboard box"][i % 4],
      verified: true,
      confidence: 0.9,
      reason: "Seeded demo history.",
    });
  });

  return { users, actions, instances: new Map() };
}

function db(): DB {
  if (!g.__ecodb) g.__ecodb = seed();
  return g.__ecodb;
}

export function getUser(id: string): User | undefined {
  return db().users.get(id);
}

export function actionsFor(userId: string): Action[] {
  return db()
    .actions.filter((a) => a.userId === userId && a.verified)
    .sort((x, y) => y.at - x.at);
}

export function addAction(a: Action): void {
  db().actions.push(a);
}

export function createInstance(binId: string): ScanInstance {
  const inst: ScanInstance = {
    id: Math.random().toString(36).slice(2, 10),
    binId,
    createdAt: Date.now(),
    usedBy: null,
  };
  db().instances.set(inst.id, inst);
  return inst;
}

export function getInstance(id: string): ScanInstance | undefined {
  return db().instances.get(id);
}

export function markInstanceUsed(id: string, userId: string): void {
  const inst = db().instances.get(id);
  if (inst) inst.usedBy = userId;
}

export function binById(id: string | null): Bin | undefined {
  return BINS.find((b) => b.id === id);
}
