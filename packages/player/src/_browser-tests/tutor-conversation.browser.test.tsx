import { render } from "@testing-library/react";
import {
  LESSON_QUESTION_PLAN_CHANGE_PART,
  LESSON_QUESTION_REPLACED_CHANGES_PART,
  LESSON_QUESTION_TOOL_OFFER_PART,
  type TutorToolOffer,
} from "@zoonk/core/lesson-questions/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { teachingStep } from "../_test-utils/lesson-steps";
import { buildLesson } from "../_test-utils/render-lesson-player";
import { buildTutor, stubTutorApi, tutorAnswerStream } from "../_test-utils/tutor-api";
import { TutorConversation } from "../questions/tutor-conversation";

/**
 * The buddy's conversation as a page of its own: an answer that proposes a plan change or offers
 * one of the app's tools shows its card with the words that say it, and an answer whose stream
 * this page lost is followed until it's done, without a reload.
 */

/** The first poll for an answer still being written comes within 1.2 s (1 s, give or take 20%). */
const FIRST_POLL_MS = 1200;

/** Long enough for the page to read a streamed part and draw what it made of it. */
const PART_READ_MS = 300;

const PROPOSED_CHANGE: PlanChangeView = {
  behind: null,
  canUndo: false,
  createdAt: "2026-10-06T12:00:00.000Z",
  days: null,
  effect: null,
  id: "01a11014-0000-7000-8000-000000000001",
  kind: "edited",
  lessonsSkipped: 0,
  officialDate: null,
  operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [6] }],
  reason: "Saturdays are off.",
  seen: false,
  source: "planEdit",
  status: "proposed",
  todaySession: null,
};

const OFFERED_CALL: TutorToolOffer = {
  call: {
    character: { name: "Ana", role: "recruiter" },
    defaultMinutes: 2,
    limit: null,
    minutes: [1, 2, 3, 5],
    plusMinutes: [],
  },
  chapterId: "01a11014-0000-7000-8000-000000000002",
  goalId: "01a11014-0000-7000-8000-00000000000a",
  kind: "conversationCall",
  unitTitle: "Talking about your projects",
};

function renderConversation() {
  render(
    <TutorConversation
      composerLabel="Message Zu"
      goalId="01a11014-0000-7000-8000-00000000000a"
      greeting="Hi! I'm Zu."
      identity={{ avatar: null, name: "Zu" }}
      placeholder="Message Zu"
      renderPlanChange={({ change }) => <p data-status={change.status}>Card: {change.reason}</p>}
      renderToolOffer={(offer) => <p>Tool: {offer.kind}</p>}
      suggestions={[]}
      tutor={buildTutor()}
    />,
  );
}

async function ask(question: string) {
  const composer = page.getByRole("textbox", { name: "Message Zu" });
  await expect.element(composer).toBeEnabled();
  await composer.fill(question);
  await userEvent.keyboard("{Enter}");
}

describe("the buddy's conversation", () => {
  it("shows a proposed plan change with the words that say it, never alone under Thinking…", async () => {
    const api = stubTutorApi({ lesson: buildLesson([teachingStep("check")]) });
    const stream = tutorAnswerStream();
    api.next("answer", () => Promise.resolve(stream.response));

    renderConversation();
    await ask("No studying on Saturdays");

    // The change is ready before the answer's first words: the card waits for them.
    stream.part(LESSON_QUESTION_PLAN_CHANGE_PART, PROPOSED_CHANGE);

    await new Promise((resolve) => {
      setTimeout(resolve, PART_READ_MS);
    });

    await expect.element(page.getByText("Thinking…")).toBeVisible();
    await expect.element(page.getByText("Card: Saturdays are off.")).not.toBeInTheDocument();

    stream.write("Sure: tap Apply to free your Saturdays.");
    await expect.element(page.getByText("Sure: tap Apply to free your Saturdays.")).toBeVisible();
    await expect.element(page.getByText("Card: Saturdays are off.")).toBeVisible();

    stream.finish();
    stream.close();
    await expect.element(page.getByText("Thinking…")).not.toBeInTheDocument();
  });

  it("says an earlier card was replaced when a newer answer changes the same thing", async () => {
    const api = stubTutorApi({ lesson: buildLesson([teachingStep("check")]) });
    const first = tutorAnswerStream();
    const second = tutorAnswerStream();
    api.next("answer", () => Promise.resolve(first.response));
    api.next("answer", () => Promise.resolve(second.response));

    renderConversation();
    await ask("No studying on Saturdays");

    first.write("Sure: tap Apply to free your Saturdays.");
    first.part(LESSON_QUESTION_PLAN_CHANGE_PART, PROPOSED_CHANGE);
    first.finish();
    first.close();

    const saturdays = page.getByText("Card: Saturdays are off.");
    await expect.element(saturdays).toHaveAttribute("data-status", "proposed");

    await ask("Actually, Sundays off instead");

    second.write("Done: tap Apply to free your Sundays.");

    second.part(LESSON_QUESTION_PLAN_CHANGE_PART, {
      ...PROPOSED_CHANGE,
      id: "01a11014-0000-7000-8000-000000000003",
      operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [0] }],
      reason: "Sundays are off.",
    });

    second.part(LESSON_QUESTION_REPLACED_CHANGES_PART, { ids: [PROPOSED_CHANGE.id] });
    second.finish();
    second.close();

    await expect
      .element(page.getByText("Card: Sundays are off."))
      .toHaveAttribute("data-status", "proposed");

    await expect.element(saturdays).toHaveAttribute("data-status", "replaced");
  });

  it("shows an app tool the answer offered under its words", async () => {
    const api = stubTutorApi({ lesson: buildLesson([teachingStep("check")]) });
    const stream = tutorAnswerStream();
    api.next("answer", () => Promise.resolve(stream.response));

    renderConversation();
    await ask("Quero treinar uma entrevista falando");

    stream.write("Toque abaixo para uma ligação curta, em voz alta.");
    stream.part(LESSON_QUESTION_TOOL_OFFER_PART, OFFERED_CALL);
    await expect.element(page.getByText("Tool: conversationCall")).toBeVisible();

    stream.finish();
    stream.close();
    await expect.element(page.getByText("Thinking…")).not.toBeInTheDocument();
    await expect.element(page.getByText("Tool: conversationCall")).toBeVisible();
  });

  it("follows an answer whose stream dropped until it's done, without a reload", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });

    onTestFinished(() => {
      vi.useRealTimers();
    });

    const api = stubTutorApi({ lesson: buildLesson([teachingStep("check")]) });

    // The server took the answer and keeps writing it; the connection to this page drops.
    api.next("answer", () => {
      api.questions = api.questions.map((question) => ({ ...question, status: "running" }));
      return Promise.reject(new TypeError("Failed to fetch"));
    });

    renderConversation();
    await ask("How many questions does the exam have?");
    await expect.element(page.getByText("Thinking…")).toBeVisible();

    const [asked] = api.questions;
    api.complete(asked?.id ?? "", "The notice says 80 questions.");

    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS);
    await expect.element(page.getByText("The notice says 80 questions.")).toBeVisible();
    await expect.element(page.getByText("Thinking…")).not.toBeInTheDocument();
  });
});
