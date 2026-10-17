import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cached: ReturnType<typeof create> | null = null;

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing DATABASE_URL (Neon Postgres connection string)");
  return drizzle(neon(url), { schema });
}

export function db() {
  return (cached ??= create());
}
