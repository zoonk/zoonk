import { beforeEach, describe, expect, it } from "vitest";
import { noteAppWrite, takeSettledAppWrites } from "./app-write-ledger";

function heldWrite() {
  const { promise, reject, resolve } = Promise.withResolvers<null>();
  void noteAppWrite(promise);
  return { fail: () => reject(new Error("The connection dropped")), save: () => resolve(null) };
}

describe("app write ledger", () => {
  beforeEach(async () => {
    await takeSettledAppWrites();
  });

  it("waits for a write still on its way, then takes it once", async () => {
    const write = heldWrite();
    const taken = takeSettledAppWrites();

    write.save();

    await expect(taken).resolves.toBe(true);
    await expect(takeSettledAppWrites()).resolves.toBe(false);
  });

  it("counts a write whose response never arrived, since it may have been saved", async () => {
    const write = heldWrite();
    write.fail();

    await expect(takeSettledAppWrites()).resolves.toBe(true);
  });

  it("leaves a write the next screen sent while the last one's refresh waited, for its own refresh", async () => {
    const left = heldWrite();
    const leftScreenRefresh = takeSettledAppWrites();
    const next = heldWrite();

    left.save();
    await expect(leftScreenRefresh).resolves.toBe(true);

    const nextScreenRefresh = takeSettledAppWrites();
    next.save();
    await expect(nextScreenRefresh).resolves.toBe(true);
  });
});
