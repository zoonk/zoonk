import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { sendEmail } from "@zoonk/mailer";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession, mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { feedbackMessageInputSchema } from "./contract";
import { submitFeedback } from "./submit-feedback";

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

  it("stores a guest's save report without an email and emails it without a reply address", async () => {
    const user = await userFixture();
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    mockGuestSession(user.id);

    const feedback = await submitFeedback(
      feedbackMessageInputSchema.parse({
        context: { platform: "web", reportType: "saveFailure", screen: "answers-save-error" },
        message: "I couldn't save my answers.",
      }),
    );

    await expect(
      prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } }),
    ).resolves.toMatchObject({
      context: { platform: "web", reportType: "saveFailure", screen: "answers-save-error" },
      email: null,
      message: "I couldn't save my answers.",
      status: "new",
      userId: user.id,
    });

    expect(sendEmail).toHaveBeenCalledExactlyOnceWith({
      subject: "Zoonk: a save keeps failing",
      textBody: [
        "From: no email",
        "",
        "I couldn't save my answers.",
        "",
        "---",
        "Report: saveFailure",
        "Screen: answers-save-error",
        "Platform: web",
      ].join("\n"),
      to: "hello@zoonk.com",
    });
  });

  it("stores a save report without a session or an email", async () => {
    mockSession(null);

    const feedback = await submitFeedback(
      feedbackMessageInputSchema.parse({
        context: { reportType: "saveFailure" },
        message: "I couldn't save my answers.",
      }),
    );

    await expect(
      prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } }),
    ).resolves.toMatchObject({ context: { reportType: "saveFailure" }, email: null, userId: null });
  });

  it("discards a guest's generated account email and emails without a reply address", async () => {
    const user = await userFixture();
    const guest = await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    mockAccountSession({ isAnonymous: true, user: guest });

    const feedback = await submitFeedback({
      email: guest.email,
      message: "I couldn't save my answers.",
    });

    await expect(
      prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } }),
    ).resolves.toMatchObject({ email: null, userId: guest.id });

    expect(sendEmail).toHaveBeenCalledExactlyOnceWith({
      subject: "Zoonk Feedback",
      textBody: "From: no email\n\nI couldn't save my answers.",
      to: "hello@zoonk.com",
    });
  });

  it("keeps a different reply email supplied by a guest", async () => {
    const user = await userFixture();
    const guest = await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });
    mockAccountSession({ isAnonymous: true, user: guest });

    const feedback = await submitFeedback({
      email: "guest@zoonk.test",
      message: "Please reply to this address.",
    });

    await expect(
      prisma.feedback.findUniqueOrThrow({ where: { id: feedback.id } }),
    ).resolves.toMatchObject({ email: "guest@zoonk.test", userId: guest.id });

    expect(sendEmail).toHaveBeenCalledExactlyOnceWith({
      replyTo: "guest@zoonk.test",
      subject: "Zoonk Feedback",
      textBody: "From: guest@zoonk.test\n\nPlease reply to this address.",
      to: "hello@zoonk.com",
    });
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
