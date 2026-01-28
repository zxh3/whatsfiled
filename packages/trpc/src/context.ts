import { type Database, getDb } from "@whatsfiled/db";

export interface Session {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
}

export interface Context {
  db: Database;
  session: Session | null;
}

export interface CreateContextOptions {
  session?: Session | null;
}

export function createContext(opts?: CreateContextOptions): Context {
  return {
    db: getDb(),
    session: opts?.session ?? null,
  };
}

export type CreateContext = typeof createContext;
