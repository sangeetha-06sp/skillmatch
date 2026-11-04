import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { apiSkill, apiUser, safeUser, type DbRow } from "../src/services/database";

const migrationDir = resolve(process.cwd(), "supabase/migrations");

describe("Supabase migration contract", () => {
  it("defines every application table and enables RLS", async () => {
    const schema = await readFile(resolve(migrationDir, "001_schema.sql"), "utf8");
    const rls = await readFile(resolve(migrationDir, "003_row_level_security.sql"), "utf8");
    for (const table of ["users", "skills", "exchange_requests", "sessions", "wallets", "wallet_transactions", "notifications", "waitlists", "disputes"]) {
      expect(schema).toMatch(new RegExp(`create table if not exists public\\.${table}\\b`, "i"));
      expect(rls).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }
    expect(schema).toMatch(/check\s*\(balance\s*>=\s*0\)/i);
    expect(schema).toMatch(/unique\s*\(idempotency_key,\s*direction\)/i);
  });

  it("settles only after both confirmations inside row-locked SQL", async () => {
    const transactions = await readFile(resolve(migrationDir, "002_exchange_functions.sql"), "utf8");
    expect(transactions).toMatch(/confirm_session_completion/i);
    expect(transactions).toMatch(/for update/i);
    expect(transactions).toMatch(/cardinality\(v_session\.confirmations\)\s*=\s*2/i);
    expect(transactions).toMatch(/insufficient wallet balance/i);
    expect(transactions).toMatch(/wallet_transactions/i);
    expect(transactions).toMatch(/cancel_scheduled_session/i);
    expect(transactions).toMatch(/open_session_dispute/i);
  });
});

describe("safe user API mapping", () => {
  it("does not serialize password hashes or token versions", () => {
    const row: DbRow = {
      id: "c66c6bd8-e508-4ca9-b7d8-99480cf4f378",
      name: "Migration Tester",
      email: "tester@example.test",
      role: "user",
      password_hash: "not-for-responses",
      token_version: 3,
      is_active: true,
    };
    const responseUser = safeUser(apiUser(row));
    expect(responseUser.passwordHash).toBeUndefined();
    expect(responseUser.tokenVersion).toBeUndefined();
    expect(responseUser.email).toBe("tester@example.test");
    const skill = apiSkill({
      id: "fd2af1eb-f113-4d38-a50e-dfd28d527d2d",
      owner_id: row.id,
      title: "Test skill",
      description: "A sufficiently detailed test listing.",
      category: "Testing",
      tags: [],
    }, apiUser(row) as unknown as DbRow);
    const owner = skill.owner as Record<string, unknown>;
    expect(owner.passwordHash).toBeUndefined();
    expect(owner.tokenVersion).toBeUndefined();
    expect(owner.email).toBeUndefined();
  });
});
