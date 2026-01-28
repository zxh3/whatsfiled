import type { CreateHTTPContextOptions } from "@trpc/server/adapters/standalone";
import { type Database, db } from "../db/index.js";

export interface Context {
  db: Database;
}

export function createContext(_opts: CreateHTTPContextOptions): Context {
  return {
    db,
  };
}

export type CreateContext = typeof createContext;
