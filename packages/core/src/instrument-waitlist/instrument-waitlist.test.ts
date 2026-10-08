import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { getInstrumentWaitlistCacheTag } from "../cache/tags";
import { joinInstrumentWaitlist } from "./join-instrument-waitlist";
import { leaveInstrumentWaitlist } from "./leave-instrument-waitlist";
import { listInstrumentWaitlist } from "./list-instrument-waitlist";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe("instrument waitlist", () => {
  beforeEach(() => {
    mockSession(null);
  });

  describe(joinInstrumentWaitlist, () => {
    it("needs a signed-in account, not a guest", async () => {
      await expect(
        joinInstrumentWaitlist({ instrument: "guitar", language: "en" }),
      ).resolves.toStrictEqual({ status: "unauthorized" });

      const guest = await userFixture();
      mockGuestSession(guest.id);

      await expect(
        joinInstrumentWaitlist({ instrument: "guitar", language: "en" }),
      ).resolves.toStrictEqual({ status: "signInRequired" });

      await expect(
        prisma.instrumentWaitlistEntry.count({ where: { userId: guest.id } }),
      ).resolves.toBe(0);
    });

    it("keeps one entry per instrument however it's written", async () => {
      const user = await userFixture();
      mockSession(user.id);

      const first = await joinInstrumentWaitlist({ instrument: " Violão ", language: "pt" });
      const again = await joinInstrumentWaitlist({ instrument: "violao", language: "pt" });

      expect(first).toMatchObject({
        entry: { instrument: "Violão", language: "pt" },
        status: "joined",
      });

      expect(again.status === "joined" && again.entry.id).toBe(
        first.status === "joined" && first.entry.id,
      );

      expect(revalidateTag).toHaveBeenCalledWith(getInstrumentWaitlistCacheTag(user.id), {
        expire: 0,
      });

      await expect(
        prisma.instrumentWaitlistEntry.count({ where: { userId: user.id } }),
      ).resolves.toBe(1);
    });
  });

  describe(listInstrumentWaitlist, () => {
    it("lists only the learner's own instruments, oldest first", async () => {
      const [user, other] = await Promise.all([userFixture(), userFixture()]);

      mockSession(other.id);
      await joinInstrumentWaitlist({ instrument: "drums", language: "en" });

      mockSession(user.id);
      await joinInstrumentWaitlist({ instrument: "piano", language: "en" });
      await joinInstrumentWaitlist({ instrument: "cello", language: "en" });

      const entries = await listInstrumentWaitlist();

      expect(entries?.map((entry) => entry.instrument)).toStrictEqual(["piano", "cello"]);
    });

    it("needs a session", async () => {
      await expect(listInstrumentWaitlist()).resolves.toBeNull();
    });
  });

  describe(leaveInstrumentWaitlist, () => {
    it("removes the learner's entry and nobody else's", async () => {
      const [user, other] = await Promise.all([userFixture(), userFixture()]);

      mockSession(user.id);
      const joined = await joinInstrumentWaitlist({ instrument: "guitar", language: "en" });
      const entryId = joined.status === "joined" ? joined.entry.id : "";

      mockSession(other.id);
      await expect(leaveInstrumentWaitlist(entryId)).resolves.toStrictEqual({ status: "notFound" });

      mockSession(user.id);

      await expect(leaveInstrumentWaitlist("not-an-id")).resolves.toStrictEqual({
        status: "notFound",
      });

      await expect(leaveInstrumentWaitlist(entryId)).resolves.toStrictEqual({ status: "left" });
      await expect(leaveInstrumentWaitlist(entryId)).resolves.toStrictEqual({ status: "notFound" });
    });

    it("needs a session", async () => {
      await expect(
        leaveInstrumentWaitlist("0190a7c3-0000-7000-8000-000000000000"),
      ).resolves.toStrictEqual({ status: "unauthorized" });
    });
  });
});
