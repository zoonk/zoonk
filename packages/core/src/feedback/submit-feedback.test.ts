import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { sendEmail } from "@zoonk/mailer";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { submitFeedback } from "./submit-feedback";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

/** The email provider is an external service; tests check what would be sent instead. */
vi.mock("@zoonk/mailer", () => ({ sendEmail: vi.fn() }));

const SENT = { data: Response.json({ ok: true }), error: null };

describe(submitFeedback, () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockResolvedValue(SENT);
  });

  it("stores a signed-in learner's message with its context and emails it", async () => {
    const user = await userFixture();
    const contentId = randomUUID();
    mockSession(user.id);

    const feedback = await submitFeedback({
      context: {
        contentId,
        contentKind: "lesson",
        platform: "web",
        screen: "lesson-completion",
        url: "/b/ai/c/math/ch/fractions/l/adding",
      },
      email: "learner@zoonk.test",
      message: "The last question had two right answers.",
    });

    await expect(
      prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } }),
    ).resolves.toMatchObject({
      context: {
        contentId,
        contentKind: "lesson",
        platform: "web",
        screen: "lesson-completion",
        url: "/b/ai/c/math/ch/fractions/l/adding",
      },
      email: "learner@zoonk.test",
      message: "The last question had two right answers.",
      status: "new",
      userId: user.id,
    });

    expect(sendEmail).toHaveBeenCalledExactlyOnceWith({
      replyTo: "learner@zoonk.test",
      subject: "Zoonk Feedback",
      textBody: [
        "From: learner@zoonk.test",
        "",
        "The last question had two right answers.",
        "",
        "---",
        "Screen: lesson-completion",
        "Page: /b/ai/c/math/ch/fractions/l/adding",
        `Content: lesson ${contentId}`,
        "Platform: web",
      ].join("\n"),
      to: "hello@zoonk.com",
    });
  });

  it("stores a visitor's message without a user or context", async () => {
    mockSession(null);

    const feedback = await submitFeedback({
      email: "visitor@zoonk.test",
      message: "Do you have a course on welding?",
    });

    await expect(
      prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } }),
    ).resolves.toMatchObject({ context: {}, userId: null });

    expect(sendEmail).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        textBody: "From: visitor@zoonk.test\n\nDo you have a course on welding?",
      }),
    );
  });

  it("snapshots the provenance of the content the message is about", async () => {
    const [lesson, privateLesson] = await Promise.all([
      libraryLessonFixture(),
      libraryLessonFixture({ visibility: "private" }),
    ]);

    const step = await libraryStepFixture({ lessonId: lesson.id });
    mockSession(null);

    const [aboutStep, aboutPrivateLesson] = await Promise.all([
      submitFeedback({
        context: { contentId: step.id, contentKind: "step" },
        email: "visitor@zoonk.test",
        message: "This screen repeats the previous one.",
      }),
      submitFeedback({
        context: { contentId: privateLesson.id, contentKind: "lesson" },
        email: "visitor@zoonk.test",
        message: "About a lesson I can't see.",
      }),
    ]);

    expect(aboutStep.context).toStrictEqual({
      contentId: step.id,
      contentKind: "step",
      provenance: { model: step.model, promptVersion: step.promptVersion, runId: step.runId },
    });

    expect(aboutPrivateLesson.context).toStrictEqual({
      contentId: privateLesson.id,
      contentKind: "lesson",
    });
  });

  it("keeps the stored message when the email can't be sent", async () => {
    mockSession(null);
    vi.mocked(sendEmail).mockResolvedValue({ data: null, error: new Error("Provider down") });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const feedback = await submitFeedback({
      email: "visitor@zoonk.test",
      message: "Saved even when email fails.",
    });

    await expect(
      prisma.feedback.findUnique({ where: { id: feedback.id } }),
    ).resolves.not.toBeNull();
  });
});
