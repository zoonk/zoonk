import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { auth as productionAuth } from "./auth";
import { BETTER_AUTH_BASE_PATH } from "./config";
import { auth as e2eAuth } from "./e2e";

const ORIGIN = "http://localhost:3000";
const GENERATE_URL = `${ORIGIN}${BETTER_AUTH_BASE_PATH}/one-time-token/generate`;

function cookieHeaders(headers: Headers) {
  const cookie = headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");

  return new Headers({ cookie, origin: ORIGIN });
}

describe("one-time token minting", () => {
  it("refuses authenticated client minting with production auth", async () => {
    const signedIn = await productionAuth.api.signInAnonymous({ returnHeaders: true });

    try {
      const response = await productionAuth.handler(
        new Request(GENERATE_URL, { headers: cookieHeaders(signedIn.headers) }),
      );

      expect(response.status).toBe(400);

      await expect(response.json()).resolves.toMatchObject({
        message: "Client requests are disabled",
      });
    } finally {
      await prisma.user.delete({ where: { id: signedIn.response.user.id } });
    }
  });

  it("mints and redeems a sign-in token server-side with production auth", async () => {
    const signedIn = await productionAuth.api.signInAnonymous({ returnHeaders: true });

    try {
      const { token } = await productionAuth.api.generateOneTimeToken({
        headers: cookieHeaders(signedIn.headers),
      });

      const verified = await productionAuth.api.verifyOneTimeToken({ body: { token } });

      expect(verified.user.id).toBe(signedIn.response.user.id);
    } finally {
      await prisma.user.delete({ where: { id: signedIn.response.user.id } });
    }
  });

  it("keeps the E2E HTTP minting override working", async () => {
    const signedIn = await e2eAuth.api.signInAnonymous({ returnHeaders: true });

    try {
      const response = await e2eAuth.handler(
        new Request(GENERATE_URL, { headers: cookieHeaders(signedIn.headers) }),
      );

      expect(response.status).toBe(200);
      const { token } = (await response.json()) as { token: string };
      const verified = await e2eAuth.api.verifyOneTimeToken({ body: { token } });

      expect(verified.user.id).toBe(signedIn.response.user.id);
    } finally {
      await prisma.user.delete({ where: { id: signedIn.response.user.id } });
    }
  });
});
