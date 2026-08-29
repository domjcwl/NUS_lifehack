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

export const BINS: Bin[] = [
  { id: "com3-l1", name: "COM3 Level 1 Foyer", block: "COM3", lat: 1.29472, lng: 103.7745, streams: ["plastic", "paper", "metal"] },
  { id: "com1-l2", name: "COM1 Level 2 Corridor", block: "COM1", lat: 1.29459, lng: 103.7739, streams: ["plastic", "paper"] },
  { id: "utown-src", name: "UTown Stephen Riady Centre", block: "UTown", lat: 1.30432, lng: 103.7727, streams: ["plastic", "paper", "metal", "glass"] },
  { id: "pgpr-blk9", name: "PGP Residences Block 9", block: "PGPR", lat: 1.29075, lng: 103.7808, streams: ["plastic", "paper", "metal"] },
  { id: "eusoff-lobby", name: "Eusoff Hall Lobby", block: "Eusoff", lat: 1.29354, lng: 103.7712, streams: ["plastic", "paper"] },
];

function seed(): DB {
  const users = new Map<string, User>();
  const actions: Action[] = [];
  const now = Date.now();

  const demo: User = {
    id: "demo",
    name: "You",
    floor: "Eusoff Hall, Level 4",
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
