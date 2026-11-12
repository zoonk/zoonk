import "server-only";
import { type ChallengeCaseParams } from "@zoonk/ai/tasks/challenge/schema";
import { prisma } from "@zoonk/db";
import { getScopeModel } from "../curriculum/curriculum-scope";
import { parseHeldBackDrafts } from "../generation/held-back-drafts";
import { holdBackLessonDraft } from "../generation/hold-back-lesson";
import { saveLessonContent } from "../lessons/_utils/save-lesson-content";
import { toChallengeCaseInputs } from "./_utils/challenge-inputs";
import { type ScriptedChallenge } from "./challenge-draft";
import { parseChallengeLessonSpec } from "./challenge-lesson-spec";

export async function loadChallengeLessonDraft({
  lessonId,
  workflowRunId,
  ...options
}: { lessonId: string; workflowRunId: string } & Pick<
  ChallengeCaseParams,
  "analytics" | "serviceTier" | "speed"
>) {
  const lesson = await prisma.lesson.findUnique({
    include: { homeChapter: { include: { homeCourse: true } } },
    where: { id: lessonId },
  });

  if (lesson?.contentStatus !== "running" || lesson.contentRunId !== workflowRunId) {
    return null;
  }

  const spec = parseChallengeLessonSpec(lesson.spec);

  if (!spec) {
    return null;
  }

  return {
    params: {
      ...toChallengeCaseInputs({ lesson, spec }),
      ...options,
      model: getScopeModel(lesson),
      problems: parseHeldBackDrafts(lesson.heldBackDrafts).flatMap((draft) =>
        draft.problems.map((problem) => problem.problem),
      ),
    },
    review: lesson.ownerId === null,
  };
}

export async function publishChallengeLessonDraft({
  scripted,
  lessonId,
  workflowRunId,
  language,
}: {
  scripted: ScriptedChallenge;
  lessonId: string;
  workflowRunId: string;
  language: string;
}) {
  if (!scripted.content || scripted.problems.length > 0) {
    return null;
  }

  return saveLessonContent({
    language,
    lessonId,
    screens: [
      {
        content: scripted.content,
        kind: "challenge",
        mathItem: null,
        provenance: { ...scripted.provenance, sources: [] },
        skillId: null,
      },
    ],
    summary: scripted.summary,
    workflowRunId,
  });
}

export async function holdBackChallengeLessonDraft({
  model,
  problems,
  lessonId,
  workflowRunId,
}: {
  model: string;
  problems: string[];
  lessonId: string;
  workflowRunId: string;
}) {
  return holdBackLessonDraft({
    lessonId,
    model,
    problems: problems.map((problem) => ({ problem, screen: null })),
    workflowRunId,
  });
}
