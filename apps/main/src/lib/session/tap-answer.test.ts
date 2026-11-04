import { describe, expect, it } from "vitest";
import { answerHere } from "./tap-answer";

function tab() {
  let here = true;

  return {
    leave: () => {
      here = false;
    },
    stillHere: () => here,
  };
}

describe(answerHere, () => {
  it("hands over the answer while the learner is still there, even one with nothing to open", async () => {
    await expect(answerHere(Promise.resolve(null), () => true)).resolves.toStrictEqual({
      answer: null,
    });
  });

  it("fails a request that never answered while the learner is still there", async () => {
    await expect(answerHere(Promise.reject(new Error("offline")), () => true)).resolves.toBe(false);
  });

  it("has nothing to report once the learner left while the request was out, however it ended", async () => {
    const answered = tab();
    const answering = answerHere(Promise.resolve(null), answered.stillHere);
    answered.leave();

    const rejected = tab();
    const rejecting = answerHere(Promise.reject(new Error("502")), rejected.stillHere);
    rejected.leave();

    await expect(answering).resolves.toBe(true);
    await expect(rejecting).resolves.toBe(true);
  });
});
