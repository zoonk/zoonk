import { randomInt } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { auth } from "./auth";
import { BETTER_AUTH_BASE_PATH } from "./config";
import { READ_ONLY_RATE_LIMIT_RULES } from "./read-rate-limit";
import { SESSION_RENEWAL_PATH } from "./session-renewal";

const ORIGIN = "http://localhost:3000";

/** A visitor of its own, so its rate-limit counts start from nothing. */
function createVisitor() {
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;

  function send({ method, path }: { method: "GET" | "POST"; path: string }) {
    return auth.handler(
      new Request(`${ORIGIN}${path}`, {
        headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": ip },
        method,
        ...(method === "POST" && { body: JSON.stringify({ provider: "google" }) }),
      }),
    );
  }

  function countRequests(path: string) {
    return prisma.rateLimit.count({ where: { key: `${ip}|${path}` } });
  }

  return { countRequests, send };
}

describe("read rate limit", () => {
  it("counts no session read, so a read writes nothing", async () => {
    const visitor = createVisitor();

    await visitor.send({ method: "GET", path: `${BETTER_AUTH_BASE_PATH}/get-session` });

    await expect(visitor.countRequests("/get-session")).resolves.toBe(0);
  });

  it("still counts the session renewal's POST and sign-ins", async () => {
    const visitor = createVisitor();

    await visitor.send({ method: "POST", path: SESSION_RENEWAL_PATH });
    await expect(visitor.countRequests("/get-session")).resolves.toBe(1);

    const signIn = { method: "POST", path: `${BETTER_AUTH_BASE_PATH}/sign-in/social` } as const;
    await visitor.send(signIn);
    await visitor.send(signIn);
    await visitor.send(signIn);

    const response = await visitor.send(signIn);
    expect(response.status).toBe(429);
  });

  it("lets through only GETs Better Auth serves", () => {
    const gets = new Set(
      Object.values(auth.api)
        .filter((endpoint) => [endpoint.options.method].flat().includes("GET"))
        .map((endpoint) => endpoint.path),
    );

    expect(Object.keys(READ_ONLY_RATE_LIMIT_RULES).filter((path) => !gets.has(path))).toStrictEqual(
      [],
    );
  });
});
