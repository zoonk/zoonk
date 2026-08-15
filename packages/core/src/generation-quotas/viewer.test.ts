import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { GENERATION_VISITOR_ID_HEADER } from "./contract";
import { getGenerationQuotaViewer } from "./viewer";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe(getGenerationQuotaViewer, () => {
  beforeEach(() => {
    vi.mocked(headers).mockResolvedValue(new Headers());
    vi.mocked(getSession).mockResolvedValue(null);
  });

  it("uses the durable visitor identity and guest username for an anonymous viewer", async () => {
    const visitorId = randomUUID();

    vi.mocked(headers).mockResolvedValue(
      new Headers({ [GENERATION_VISITOR_ID_HEADER]: visitorId }),
    );

    await expect(getGenerationQuotaViewer()).resolves.toMatchObject({
      actor: { distinctId: `guest:${visitorId}`, username: "guest" },
      viewer: "guest",
    });
  });

  it("uses the existing session identity and username for an authenticated viewer", async () => {
    const username = `rate-limit-${randomUUID()}`;
    const fixture = await userFixture();
    const user = await prisma.user.update({ data: { username }, where: { id: fixture.id } });
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    await expect(getGenerationQuotaViewer()).resolves.toMatchObject({
      actor: { distinctId: user.id, username },
      viewer: "authenticated",
    });
  });
});
