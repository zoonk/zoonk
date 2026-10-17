import "server-only";
import { type ChallengeCaseParams, generateChallengeCase } from "@zoonk/ai/tasks/v2/challenge/case";
import { type Lesson } from "@zoonk/db";
import { checkWrittenChallenge } from "../challenge-case-content";
import { type ChallengeLessonSpec } from "../challenge-lesson-spec";

/** What the case writer reads about the chapter a challenge closes. */
export type ChallengeCaseInputs = Omit<ChallengeCaseParams, "analytics" | "model" | "problems">;

type ChallengeLesson = Pick<Lesson, "language" | "level" | "title"> & {
  homeChapter: {
    description: string | null;
    homeCourse: { title: string } | null;
    title: string;
  } | null;
};

/** The case writer's inputs for a chapter's challenge lesson and its stored spec. */
export function toChallengeCaseInputs({
  lesson,
  spec,
}: {
  lesson: ChallengeLesson;
  spec: ChallengeLessonSpec;
}): ChallengeCaseInputs {
  const chapter = lesson.homeChapter;

  return {
    chapterDescription: chapter?.description ?? null,
    chapterTitle: chapter?.title ?? lesson.title,
    courseTitle: chapter?.homeCourse?.title ?? chapter?.title ?? lesson.title,
    language: lesson.language,
    level: lesson.level,
    skills: spec.skills,
    variant: spec.variant,
  };
}

type DraftedChallenge = {
  content: ReturnType<typeof checkWrittenChallenge>["content"];
  problems: string[];
  provenance: Awaited<ReturnType<typeof generateChallengeCase>>["provenance"];
  summary: string[];
};

/**
 * Drafts a case and checks it against the step contract (every id it points at, 2 to 4 decisions
 * on every path, no loops, a decision that matters at every step); one more draft gets the
 * problems when the first fails. `content` is null when both fail.
 */
export async function draftChallengeCase({
  analytics,
  inputs,
  model,
  serviceTier,
}: {
  analytics: ChallengeCaseParams["analytics"];
  inputs: ChallengeCaseInputs;
  model?: string;
  serviceTier?: ChallengeCaseParams["serviceTier"];
}): Promise<DraftedChallenge> {
  const draft = async (problems: string[]): Promise<DraftedChallenge> => {
    const written = await generateChallengeCase({
      ...inputs,
      analytics,
      model,
      problems,
      serviceTier,
    });

    const checked = checkWrittenChallenge({ variant: inputs.variant, written: written.data });

    return {
      ...checked,
      provenance: written.provenance,
      summary: written.data.summary.map((idea) => idea.trim()).filter(Boolean),
    };
  };

  const first = await draft([]);
  return first.content ? first : draft(first.problems);
}
