import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_HINT_TAG_PATTERN } from "./session-hint";
import { encodeSessionHintTag } from "./session-hint-tag";

const SECRET = "session-hint-tag-test-secret-with-enough-entropy";

describe(encodeSessionHintTag, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("gives a learner the same well-formed tag every time, so a new session of theirs changes nothing", () => {
    const userId = randomUUID();
    const tag = encodeSessionHintTag({ secret: SECRET, userId });

    expect(tag).toMatch(SESSION_HINT_TAG_PATTERN);
    expect(encodeSessionHintTag({ secret: SECRET, userId })).toBe(tag);
  });

  it("gives every learner their own tag", () => {
    const tags = Array.from({ length: 50 }, () =>
      encodeSessionHintTag({ secret: SECRET, userId: randomUUID() }),
    );

    expect(new Set(tags).size).toBe(tags.length);
  });

  it("never shows the learner's id, and can't be made without the auth secret", () => {
    const userId = randomUUID();
    const tag = encodeSessionHintTag({ secret: SECRET, userId });
    const body = Buffer.from(tag.slice("t1.".length), "base64url").toString("latin1");

    expect(tag).not.toContain(userId);
    expect(tag).not.toContain(Buffer.from(userId).toString("base64url").slice(0, 8));
    expect(body).not.toContain(userId.slice(0, 8));
    expect(encodeSessionHintTag({ secret: `${SECRET}-rotated`, userId })).not.toBe(tag);
  });

  it("differs between environments sharing a secret", () => {
    const userId = randomUUID();
    const development = encodeSessionHintTag({ secret: SECRET, userId });

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    const preview = encodeSessionHintTag({ secret: SECRET, userId });

    vi.stubEnv("VERCEL_ENV", "production");
    const production = encodeSessionHintTag({ secret: SECRET, userId });

    expect(new Set([development, preview, production]).size).toBe(3);
  });
});
