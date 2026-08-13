import { Database } from "@db/sqlite";

export const db = new Database("voip.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT NOT NULL PRIMARY KEY,
    voip_token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL,
    avatar TEXT,
    updated_at INTEGER NOT NULL
  )
`);
