import { isDeepStrictEqual } from "node:util";
import { type TransactionClient, sql } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import {
  type LevelTestBank,
  levelTestBankSchema,
} from "../../../language/level-test/level-test-contract";
import { levelTestPart } from "../../../language/level-test/level-test-parts";
import { type Json, type Resolution, refuse, toJson } from "../_utils/resolved-change";
import {
  type FieldChange,
  defineFixHandler,
  fieldChangeSchema,
  idSchema,
  setFieldsSchema,
  toRevertedSet,
  toSetProposal,
} from "./fix-handler";

type BankStored = {
  fields: FieldChange[];
  id: string;
  model: "LanguageLevelTest";
  op: "set";
  /** What a learner taking the test answers: `question:<id>` and `speaking:<level>`. */
  parts: string[];
};

type BankDiff =
  | { problem: string }
  | { answerKeys: string[]; parts: string[]; questions: string[]; speaking: string[] };

type BankQuestion = LevelTestBank["questions"][number];

function questionShape(bank: LevelTestBank) {
  return bank.questions.map(({ id, level, skill }) => ({ id, level, skill }));
}

function speakingLevels(bank: LevelTestBank) {
  return bank.speaking.map((entry) => entry.level);
}

function wordsOf({ options, passage, question }: BankQuestion) {
  return { options, passage, question };
}

function changedQuestions({
  after,
  before,
  read,
}: {
  after: LevelTestBank;
  before: LevelTestBank;
  read: (question: BankQuestion) => unknown;
}): string[] {
  return after.questions.flatMap((question, index) => {
    const old = before.questions[index];
    return old && isDeepStrictEqual(read(old), read(question)) ? [] : [question.id];
  });
}

/**
 * A learner may be partway through the test while a fix lands, and answers are saved by question
 * id and option index, so the questions keep their ids, levels, skills and order, and each changes
 * its words or which option is right, never both.
 */
function diffBanks({ after, before }: { after: LevelTestBank; before: LevelTestBank }): BankDiff {
  if (!isDeepStrictEqual(questionShape(after), questionShape(before))) {
    return { problem: "The questions keep their ids, levels, skills and order." };
  }

  if (!isDeepStrictEqual(speakingLevels(after), speakingLevels(before))) {
    return { problem: "The sentences to say keep their levels and order." };
  }

  const questions = changedQuestions({ after, before, read: wordsOf });
  const answerKeys = changedQuestions({ after, before, read: (question) => question.answerIndex });
  const both = questions.find((id) => answerKeys.includes(id));

  if (both) {
    return {
      problem: `Question ${both} changes both its words and which option is right. Propose one, and the other once it's approved.`,
    };
  }

  const speaking = after.speaking.flatMap((entry, index) =>
    isDeepStrictEqual(entry, before.speaking[index]) ? [] : [entry.level],
  );

  return {
    answerKeys,
    parts: [
      ...[...questions, ...answerKeys].map((questionId) =>
        levelTestPart({ kind: "question", questionId }),
      ),
      ...speaking.map((level) => levelTestPart({ kind: "speaking", level })),
    ],
    questions,
    speaking,
  };
}

async function resolveBankSet(
  db: TransactionClient,
  { id, set }: { id: string; set: Record<string, Json> },
): Promise<Resolution<BankStored>> {
  if (!isDeepStrictEqual(Object.keys(set), ["content"])) {
    return refuse("A LanguageLevelTest fix sets only content, the whole bank as JSON.");
  }

  const row = await db.languageLevelTest.findUnique({ select: { content: true }, where: { id } });

  if (!row) {
    return refuse(`No LanguageLevelTest with id ${id}.`);
  }

  const before = levelTestBankSchema.safeParse(row.content);
  const after = levelTestBankSchema.safeParse(set.content);

  if (!before.success) {
    return refuse(`LanguageLevelTest ${id}'s stored bank doesn't parse, so it can't be fixed.`);
  }

  if (!after.success) {
    return refuse(`content isn't a level test bank: ${z.prettifyError(after.error)}`);
  }

  const diff = diffBanks({ after: after.data, before: before.data });

  if ("problem" in diff) {
    return refuse(diff.problem);
  }

  if (diff.parts.length === 0) {
    return refuse(`LanguageLevelTest ${id} already has this content.`);
  }

  return {
    effects: [
      {
        answerKeys: diff.answerKeys,
        kind: "levelTestChanged",
        questions: diff.questions,
        speaking: diff.speaking,
      },
    ],
    ok: true,
    stored: {
      fields: [{ after: toJson(after.data), before: toJson(row.content), field: "content" }],
      id,
      model: "LanguageLevelTest",
      op: "set",
      parts: diff.parts,
    },
    unit: { id, kind: "levelTest" },
  };
}

function contentOf(fields: readonly FieldChange[]) {
  const content = fields.find((field) => field.field === "content")?.after;

  if (!isJsonObject(content)) {
    throw new Error("A level test fix holds no bank");
  }

  return content;
}

export const levelTestSet = defineFixHandler({
  apply: async (tx, stored) => {
    await tx.languageLevelTest.update({
      data: { content: contentOf(stored.fields) },
      where: { id: stored.id },
    });
  },
  model: "LanguageLevelTest",
  op: "set",
  proposal: {
    fields: ["content"],
    rules:
      "A language pair's level test bank; send the whole content. Its questions keep their ids, levels, skills, option count and order, and each changes its words (passage, question, options) or which option is right (answerIndex), never both. The sentences to say keep their levels and order. A listening passage that changes is voiced again when a learner plays it. A learner already taking the test isn't marked wrong for a question the fix changed.",
    schema: z.strictObject({
      id: idSchema,
      model: z.literal("LanguageLevelTest"),
      set: setFieldsSchema,
    }),
  },
  resolve: (db, proposed) => resolveBankSet(db, proposed),
  revert: (db, stored) => resolveBankSet(db, toRevertedSet(stored)),
  stored: z.object({
    fields: z.array(fieldChangeSchema).min(1),
    id: idSchema,
    model: z.literal("LanguageLevelTest"),
    op: z.literal("set"),
    parts: z.array(z.string()),
  }),
  table: sql`language_level_tests`,
  targets: ({ id }) => [{ id, model: "LanguageLevelTest", part: "content" }],
  toProposed: (stored) => toSetProposal(stored),
});
