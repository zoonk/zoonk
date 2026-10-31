import { afterEach, describe, expect, it, vi } from "vitest";
import { getContentDatabaseUrls } from "../../../../packages/db/src/prisma/_sync-content/config";

const LOCAL_DATABASE_URL = "postgresql://postgres:secret@localhost:5432/zoonk";
const SOURCE_DATABASE_URL = "postgresql://postgres:secret@source.example.invalid/zoonk";

describe(getContentDatabaseUrls, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["DATABASE_URL", "DATABASE_URL_UNPOOLED"])(
    "refuses a remote query override in %s before syncing content",
    (variable) => {
      vi.stubEnv("CONTENT_SOURCE_DATABASE_URL", SOURCE_DATABASE_URL);
      vi.stubEnv("DATABASE_URL", LOCAL_DATABASE_URL);
      // oxlint-disable-next-line unicorn/no-useless-undefined -- Vitest requires undefined to remove an environment variable.
      vi.stubEnv("DATABASE_URL_UNPOOLED", undefined);
      vi.stubEnv(variable, `${LOCAL_DATABASE_URL}?host=production.example.invalid`);

      expect(getContentDatabaseUrls).toThrow(/local Zoonk development database/u);
    },
  );

  it("preserves the source and local destination with ordinary connection options", () => {
    const destinationConnectionString = `${LOCAL_DATABASE_URL}?sslmode=disable`;

    vi.stubEnv("CONTENT_SOURCE_DATABASE_URL", SOURCE_DATABASE_URL);
    vi.stubEnv("DATABASE_URL", destinationConnectionString);
    // oxlint-disable-next-line unicorn/no-useless-undefined -- Vitest requires undefined to remove an environment variable.
    vi.stubEnv("DATABASE_URL_UNPOOLED", undefined);

    expect(getContentDatabaseUrls()).toStrictEqual({
      destinationConnectionString,
      sourceConnectionString: SOURCE_DATABASE_URL,
    });
  });
});
