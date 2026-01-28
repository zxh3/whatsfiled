import { type Database, getDb } from "@whatsfiled/db";

export interface Context {
  db: Database;
}

export function createContext(): Context {
  return {
    db: getDb(),
  };
}

export type CreateContext = typeof createContext;
