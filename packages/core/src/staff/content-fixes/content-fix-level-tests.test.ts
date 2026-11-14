import { prisma } from "@zoonk/db";
import { levelTestBankFixture } from "@zoonk/testing/fixtures/level-tests";
import { describe, expect, it } from "vitest";
import {
  approve,
  proposeFix,
  signInApprover,
  signInProposer,
} from "./_test-utils/content-fix-steps";
import { proposeContentFix } from "./propose-content-fix";

async function bankFixture() {
  const { pair, questions } = await levelTestBankFixture({ levels: ["A1"] });
  const row = await prisma.languageLevelTest.findUniqueOrThrow({ where: { languagePair: pair } });
  const speaking = [{ level: "A1", sentence: "Say hello", translation: "Diga olá" }];

  await prisma.languageLevelTest.update({
    data: { content: { questions, speaking } },
    where: { id: row.id },
  });

  return { id: row.id, questions, speaking };
}

type Bank = Awaited<ReturnType<typeof bankFixture>>;

function withQuestion(bank: Bank, index: number, change: object) {
  return {
    questions: bank.questions.map((question, at) =>
      at === index ? { ...question, ...change } : question,
    ),
    speaking: bank.speaking,
  };
}

function setBank(id: string, content: object) {
  return {
    changes: [{ id, model: "LanguageLevelTest", set: { content } }],
    reason: "A typo in the level test.",
  };
}

describe("level test bank fixes", () => {
  it("fixes a question's words and, in another fix, which option is right", async () => {
    const bank = await bankFixture();
    const [first, second] = bank.questions;
    await signInProposer();

    const reworded = await proposeFix(
      setBank(bank.id, withQuestion(bank, 0, { question: "What does the message say?" })),
    );

    expect(reworded).toMatchObject({
      changes: [{ model: "LanguageLevelTest", parts: [`question:${first?.id}`] }],
      effects: [{ answerKeys: [], kind: "levelTestChanged", questions: [first?.id], speaking: [] }],
      unit: "levelTest",
      unitId: bank.id,
    });

    const rekeyed = await proposeFix(setBank(bank.id, withQuestion(bank, 1, { answerIndex: 2 })));

    expect(rekeyed.effects).toStrictEqual([
      { answerKeys: [second?.id], kind: "levelTestChanged", questions: [], speaking: [] },
    ]);

    const { key } = await signInApprover();
    await approve({ fixId: reworded.id, key });

    const row = await prisma.languageLevelTest.findUniqueOrThrow({ where: { id: bank.id } });

    expect(row.content).toMatchObject({
      questions: expect.arrayContaining([
        expect.objectContaining({ id: first?.id, question: "What does the message say?" }),
      ]),
    });
  });

  it.each([
    [
      "a question's words and right option together",
      (bank: Bank) => withQuestion(bank, 0, { answerIndex: 2, question: "Which one?" }),
    ],
    ["a question's id", (bank: Bank) => withQuestion(bank, 0, { id: "reading-A1-9" })],
    ["the questions' count", (bank: Bank) => ({ ...bank, questions: bank.questions.slice(1) })],
    [
      "a sentence's level",
      (bank: Bank) => ({
        questions: bank.questions,
        speaking: [{ ...bank.speaking[0], level: "A2" }],
      }),
    ],
  ])("refuses %s", async (_, change) => {
    const bank = await bankFixture();
    await signInProposer();

    await expect(proposeContentFix(setBank(bank.id, change(bank)))).resolves.toMatchObject({
      status: "invalid",
    });
  });
});
