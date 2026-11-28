import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import {
  type LanguageLessonActivities,
  generateLanguageLesson,
  generateLanguageLessonActivities,
} from "@zoonk/ai/tasks/language/language-lesson";
import { checkLanguageLesson } from "@zoonk/ai/tasks/language/language-lesson-check";
import { prisma } from "@zoonk/db";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import { signInProposer } from "../../staff/content-fixes/_test-utils/content-fix-steps";
import { proposeContentFix } from "../../staff/content-fixes/propose-content-fix";
import { claimLibraryGeneration } from "../claims/generation-claim";
import {
  languageDialogue,
  languageLessonDraft,
  languagePatternTable,
} from "./_test-utils/language-lesson-draft";
import { buildLanguageLessonSteps } from "./_utils/language-lesson-steps";
import { draftLanguageActivities } from "./add-language-activities";
import {
  publishLanguageLessonDraft,
  writeLanguageLessonDraft,
} from "./write-language-lesson-content";

type Draft = ReturnType<typeof languageLessonDraft>;

const PROVENANCE = {
  generatedAt: new Date().toISOString(),
  latencyMs: 1,
  model: "openai/gpt-6.1-terra",
  promptVersion: "test-prompt",
  provider: "openai",
  requestedModel: "openai/gpt-6.1-terra",
  runId: "writer-run",
  usage: {},
};

function uniqueDraft(): Draft {
  const key = crypto.randomUUID();
  const draft = languageLessonDraft();
  const suffix = (text: string) => `${text} ${key}`;

  return {
    ...draft,
    sentences: draft.sentences.map((sentence) => ({
      ...sentence,
      sentence: suffix(sentence.sentence),
    })),
    words: draft.words.map((word) => ({
      ...word,
      distractors: word.distractors.map(suffix),
      word: suffix(word.word),
    })),
  };
}

async function publishedLesson(draft: Draft) {
  storeBlobUploads();

  vi.mocked(generateLanguageAudio).mockResolvedValue({
    data: {
      audio: new Uint8Array([1, 2, 3]),
      durationMs: 900,
      format: "mp3",
      provenance: { ...PROVENANCE, runId: "speech-run" },
    },
    error: null,
  });

  vi.mocked(generateLanguageLesson).mockResolvedValueOnce({
    data: draft,
    provenance: PROVENANCE,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });

  const [lesson, skill] = await Promise.all([
    libraryLessonFixture({ language: "pt", targetLanguage: "en" }),
    skillFixture(),
    aiOrganizationFixture(),
  ]);

  await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });
  const workflowRunId = crypto.randomUUID();
  await claimLibraryGeneration({ id: lesson.id, target: "lessonContent", workflowRunId });
  const written = await writeLanguageLessonDraft({ lessonId: lesson.id, workflowRunId });

  if (written.status !== "drafted") {
    throw new Error("Expected the fixture lesson to be drafted");
  }

  await publishLanguageLessonDraft({ draft: written.draft, lessonId: lesson.id, workflowRunId });
  return lesson;
}

function mockActivities(data: LanguageLessonActivities) {
  vi.mocked(generateLanguageLessonActivities).mockResolvedValueOnce({
    data,
    provenance: { ...PROVENANCE, runId: "activities-run" },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

function mockCheck(issues: { problem: string; fix: string; screen: number | null }[]) {
  vi.mocked(checkLanguageLesson).mockResolvedValueOnce({
    data: { issues },
    provenance: { ...PROVENANCE, runId: "check-run" },
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

function stepsOf(lessonId: string) {
  return prisma.step.findMany({ orderBy: { position: "asc" }, where: { lessonId } });
}

describe(draftLanguageActivities, () => {
  it("adds both screens where a new lesson has them and keeps every published screen", async () => {
    const draft = uniqueDraft();
    const lesson = await publishedLesson(draft);
    const published = await stepsOf(lesson.id);
    const activities = { dialogue: languageDialogue(), patternTable: languagePatternTable() };

    mockActivities(activities);
    mockCheck([]);

    const result = await draftLanguageActivities({ lessonId: lesson.id });

    if (result.status !== "drafted") {
      throw new Error(`Expected a draft, got ${JSON.stringify(result)}`);
    }

    const newLesson = buildLanguageLessonSteps({
      content: { ...draft, ...activities },
      learnerLanguage: "pt",
      sentenceIds: draft.sentences.map((_, index) => String(index)),
      targetLanguage: "en",
      wordIds: draft.words.map((_, index) => String(index)),
    });

    const kinds = result.setScreens.screens.map((screen) =>
      "id" in screen ? published.find(({ id }) => id === screen.id)?.kind : screen.kind,
    );

    expect(kinds).toStrictEqual(newLesson.map(({ kind }) => kind));
    expect(result.added).toStrictEqual(["patternTable", "dialogue"]);

    expect(result.setScreens.screens.filter((screen) => "id" in screen)).toStrictEqual(
      published.map(({ id }) => ({ id })),
    );

    expect(generateLanguageLessonActivities).toHaveBeenCalledWith(
      expect.objectContaining({
        lesson: expect.objectContaining({
          tip: expect.objectContaining({ title: draft.tip.title }),
          words: draft.words.map(({ translation, word }) => ({ translation, word })),
        }),
        targetLanguage: "en",
      }),
    );

    await signInProposer();

    // oxlint-disable-next-line unicorn/prefer-structured-clone -- The fix reaches `staff fixes propose` as the API's JSON.
    const setScreens: unknown = JSON.parse(JSON.stringify(result.setScreens));

    await expect(
      proposeContentFix(
        { changes: [{ id: lesson.id, model: "Lesson", setScreens }], reason: result.reason },
        { check: true },
      ),
    ).resolves.toMatchObject({ status: "checked" });
  });

  it("leaves out a screen the check flags and reports what it found on published ones", async () => {
    const lesson = await publishedLesson(uniqueDraft());
    const published = await stepsOf(lesson.id);
    const tip = published.findIndex(({ kind }) => kind === "explanation");

    mockActivities({ dialogue: languageDialogue(), patternTable: languagePatternTable() });

    mockCheck([
      { fix: "Use another word.", problem: "Bill doesn't follow rent here.", screen: tip + 1 },
      { fix: "Translate it.", problem: "The tip's example is wrong.", screen: tip },
    ]);

    await expect(draftLanguageActivities({ lessonId: lesson.id })).resolves.toMatchObject({
      added: ["dialogue"],
      dropped: [
        "The check flagged the patternTable: Bill doesn't follow rent here. Fix: Use another word.",
      ],
      findings: [
        { problem: "The tip's example is wrong. Fix: Translate it.", stepId: published[tip]?.id },
      ],
      status: "drafted",
    });
  });

  it("skips a lesson where neither fits, and one that already has an activity, without a check", async () => {
    const lesson = await publishedLesson(uniqueDraft());
    mockActivities({ dialogue: null, patternTable: null });

    await expect(draftLanguageActivities({ lessonId: lesson.id })).resolves.toStrictEqual({
      lessonId: lesson.id,
      reason: "Neither a dialogue nor a table fits.",
      status: "skipped",
    });

    const withDialogue = await publishedLesson({ ...uniqueDraft(), dialogue: languageDialogue() });

    await expect(draftLanguageActivities({ lessonId: withDialogue.id })).resolves.toStrictEqual({
      lessonId: withDialogue.id,
      reason: "Already has an activity screen.",
      status: "skipped",
    });

    expect(generateLanguageLessonActivities).toHaveBeenCalledOnce();
    expect(checkLanguageLesson).not.toHaveBeenCalled();
  });
});
