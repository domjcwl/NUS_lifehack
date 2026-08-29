/**
 * Minimal typings for node:sqlite, which ships in Node 22+ but is not yet in
 * the installed @types/node. Only the surface repo.ts actually uses is declared,
 * so a wrong call is still a type error rather than an `any` escape hatch.
 */
declare module "node:sqlite" {
  interface StatementSync {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  export class DatabaseSync {
    constructor(path: string, options?: { open?: boolean; readOnly?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
