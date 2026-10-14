import { isLocalDevelopmentDatabase } from "@zoonk/db/local-database";
import { describe, expect, it } from "vitest";

describe(isLocalDevelopmentDatabase, () => {
  it.each([
    "postgresql://postgres:secret@localhost:5432/zoonk",
    "postgres://postgres:secret@127.0.0.1:5432/zoonk",
    "postgresql://postgres:secret@[::1]:5432/zoonk",
    "postgresql://postgres:secret@localhost:5432/zoonk_wt_0123456789ab_dev",
    "postgresql://postgres:secret@localhost:5432/%7Aoonk",
    "postgresql://postgres:secret@localhost:5432/zoonk?sslmode=disable&application_name=local-tool",
  ])("allows a local development connection: %s", (connectionString) => {
    expect(isLocalDevelopmentDatabase(connectionString)).toBe(true);
  });

  it.each([
    "host=production.example.invalid",
    "host=localhost",
    "host=",
    "host=localhost&host=production.example.invalid",
    "%68ost=production.example.invalid",
    "hostaddr=203.0.113.1",
    "service=production",
    "port=6432",
    "database=zoonk_test",
    "dbname=zoonk_e2e",
    "db=zoonk_test",
    "connectionString=postgresql%3A%2F%2Fproduction.example.invalid%2Fzoonk",
  ])("refuses connection target query parameters: %s", (query) => {
    expect(
      isLocalDevelopmentDatabase(`postgresql://postgres:secret@localhost:5432/zoonk?${query}`),
    ).toBe(false);
  });

  it.each([
    "postgresql://postgres:secret@production.example.invalid/zoonk",
    "postgresql://postgres:secret@localhost/zoonk_test",
    "postgresql://postgres:secret@localhost/zoonk_e2e",
    "postgresql://postgres:secret@localhost/zoonk_wt_0123456789ab_test",
    "https://localhost/zoonk",
    "socket://localhost/zoonk",
    "postgresql://postgres:secret@localhost/%",
    "postgresql://postgres:secret@localhost/%FF",
    "not a URL",
    "",
  ])("refuses invalid or non-development connections without throwing: %s", (connectionString) => {
    expect(isLocalDevelopmentDatabase(connectionString)).toBe(false);
  });
});
