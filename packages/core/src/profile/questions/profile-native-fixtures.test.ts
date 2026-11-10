import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { answerProfileQuestion } from "./answer-profile-question";
import { getProfileQuestions } from "./get-profile-questions";
import { normalizeProfileAnswer } from "./profile-answer-normalization";
import { profileAnswerInputSchema } from "./profile-question-contract";

/** Each answer as the apps send it, with every field, so a client's rebuilt answer can equal it. */
const ANSWERS = [
  { answer: { declined: false, job: "software engineer", status: "work" }, question: "work" },
  { answer: { declined: false, job: null, status: "student" }, question: "work" },
  { answer: { declined: true, job: null, status: null }, question: "work" },
  {
    answer: { declined: false, favorites: "Python", picks: ["figma", "vsCode"] },
    question: "tools",
  },
  {
    answer: {
      declined: false,
      studies: [
        { field: "media", subject: "journalism" },
        { field: "other", subject: "astronomy" },
        { field: "business", subject: null },
      ],
    },
    question: "studies",
  },
  {
    answer: { declined: false, favorites: "Star Trek, Fringe", picks: ["anime", "sciFi"] },
    question: "watch",
  },
  {
    answer: { declined: false, favorites: "", picks: ["novelas"] },
    locale: "pt",
    question: "watch",
  },
  { answer: { declined: false, favorites: "Radiolab", picks: [] }, question: "listen" },
  { answer: { declined: false, favorites: "", picks: ["soccer"] }, question: "play" },
  { answer: { declined: true, favorites: "", picks: [] }, question: "read" },
  {
    answer: { declined: false, favorites: "baking bread", picks: ["cook", "travel"] },
    question: "activities",
  },
  {
    answer: {
      conditions: [
        { condition: "adhd", note: null },
        { condition: "other", note: "migraines" },
      ],
      consented: true,
      declined: false,
    },
    question: "conditions",
  },
  { answer: { conditions: [], consented: false, declined: true }, question: "conditions" },
  {
    answer: {
      declined: false,
      needs: ["stepByStep", "shorterDays"],
      note: "I understand diagrams better than text",
      soundEffects: false,
    },
    question: "learningSupport",
  },
  {
    answer: { declined: true, needs: [], note: null, soundEffects: true },
    question: "learningSupport",
  },
] as const;

/**
 * The Apple and Android apps rebuild an answer from the `saved` part of the question view: these
 * pairs, written by core's own save and read, are what their adapter tests read.
 */
describe("profile answers as native clients read them back", () => {
  it("pairs each saved answer with the question view core returns for it", async () => {
    const fixtures = [];

    for (const input of ANSWERS) {
      // oxlint-disable-next-line no-await-in-loop -- one learner at a time: the session is global.
      const user = await userFixture();
      mockSession(user.id);

      const parsed = profileAnswerInputSchema.parse({
        answer: input.answer,
        question: input.question,
      });

      const locale = "locale" in input ? input.locale : "en";
      // oxlint-disable-next-line no-await-in-loop -- one learner at a time: the session is global.
      await expect(answerProfileQuestion({ input: parsed, locale })).resolves.toMatchObject({
        status: "saved",
      });
      // oxlint-disable-next-line no-await-in-loop -- one learner at a time: the session is global.
      const view = await getProfileQuestions({ locale: "en" });

      fixtures.push({
        answer: normalizeProfileAnswer(parsed),
        view: view?.questions.find((question) => question.id === input.question),
      });
    }

    await expect(`${JSON.stringify({ fixtures }, null, 2)}\n`).toMatchFileSnapshot(
      "profile-native-fixtures.json",
    );
  });
});
