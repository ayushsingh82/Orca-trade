import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = NeonHttpDatabase<typeof schema>;
let cached: Db | null = null;

const isLocal = (url: string) => /^postgres(ql)?:\/\/[^@]*@?(localhost|127\.0\.0\.1)[:/]/.test(url);

function create(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL (Neon Postgres connection string)");
  if (isLocal(url)) {
    // Local development and tests: a plain Postgres over TCP. Neon's HTTP driver cannot talk to it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle: local } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    // Same query API as the Neon driver, which is what production uses.
    return local(new Pool({ connectionString: url }), { schema }) as unknown as Db;
  }
  return drizzle(neon(url), { schema });
}

export function db() {
  return (cached ??= create());
}
