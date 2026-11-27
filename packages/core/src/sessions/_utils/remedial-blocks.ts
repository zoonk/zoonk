import { isPhaseChallenge } from "../../checkpoints/_utils/challenge-reach";
import { type FollowUp } from "../../follow-ups/follow-up-contract";
import { MINUTES_PER_REVIEW, getDailyReviewCap } from "../../learner/review-load";
import { selectMistakesToPractice } from "../../mistakes/mistake-drills";
import { toBlockPayload } from "../block-payload";
import { takeReviewCapsules } from "../capsules";
import { isOutsidePlanLesson } from "../day-block";
import { type PlannedBlock, type SessionBuildInput } from "../session-builder";
import { buildPracticeBlocks } from "./practice-blocks";

type MistakeCandidate = { id: string; minutes: number; skillId: string | null };

type RemedialFollowUp = Extract<FollowUp, { kind: "writeLesson" | "writeSecondTake" }>;

export type TeachingOption =
  | PlannedBlock
  | { estimatedMinutes: number; followUp: RemedialFollowUp };

export type RemedialWork = {
  kept?: { mistakes: number; teaching: number };
  mistakes: readonly MistakeCandidate[];
  teaching: readonly TeachingOption[];
  dated: boolean;
};

function sumMinutes(blocks: readonly PlannedBlock[]): number {
  return blocks.reduce((sum, block) => sum + block.estimatedMinutes, 0);
}

const ROUNDING_MIDPOINT = 0.5;

function getReviewMinutes(placement: number, questions: number): number {
  return Math.round((placement + questions) * MINUTES_PER_REVIEW);
}

function cutReview(review: PlannedBlock | undefined, cut: number): PlannedBlock[] {
  if (!review || review.estimatedMinutes <= cut) {
    return [];
  }

  if (cut === 0) {
    return [review];
  }

  const minutes = review.estimatedMinutes - cut;

  const { capsules, placementItemIds } = review.payload;

  const room =
    Math.ceil((minutes + ROUNDING_MIDPOINT) / MINUTES_PER_REVIEW) - 1 - placementItemIds.length;

  const kept = takeReviewCapsules({ capsules, room });
  const questions = kept.reduce((sum, capsule) => sum + capsule.itemIds.length, 0);
  const estimatedMinutes = getReviewMinutes(placementItemIds.length, questions);

  return estimatedMinutes
    ? [
        {
          ...review,
          estimatedMinutes,
          payload: {
            ...review.payload,
            capsules: kept,
            skillIds: kept.flatMap((capsule) => capsule.skillIds),
          },
        },
      ]
    : [];
}

function fitMistakes({
  input,
  minutes,
  work,
}: {
  input: SessionBuildInput;
  minutes: number;
  work: RemedialWork;
}): PlannedBlock[] {
  const cap =
    input.freshStart === "welcomeBack" ? 1 : Math.max(1, Math.floor(getDailyReviewCap(input) / 3));

  const candidates = selectMistakesToPractice({
    limit: work.mistakes.length,
    mistakes: work.mistakes,
  });

  const picked: MistakeCandidate[] = [];
  let spent = 0;

  for (const mistake of candidates) {
    if (Math.ceil(spent + mistake.minutes) <= minutes) {
      picked.push(mistake);
      spent += mistake.minutes;
    }

    if (picked.length === cap) {
      break;
    }
  }

  return picked.length > 0
    ? [
        {
          canDo: null,
          estimatedMinutes: Math.ceil(spent),
          kind: "practice",
          lessonId: null,
          payload: toBlockPayload({
            mistakeIds: picked.map(({ id }) => id),
            skillIds: [...new Set(picked.flatMap(({ skillId }) => skillId ?? []))],
          }),
        },
      ]
    : [];
}

function shrinkPractice({
  blocks,
  input,
  minutes,
  reviewedSkillIds,
}: {
  blocks: readonly PlannedBlock[];
  input: SessionBuildInput;
  minutes: number;
  reviewedSkillIds: readonly string[];
}) {
  const ids = new Set(blocks.flatMap(({ payload }) => payload.itemIds));

  return buildPracticeBlocks({
    fullReviewSkillIds: input.fullReviewSkillIds,
    minutes,
    netScored: input.netScored,
    planItemId: input.reviewPlanItemId,
    planItemKey: input.reviewPlanItemKey,
    practice: input.practice.filter(({ itemId }) => ids.has(itemId)),
    reviewedSkillIds,
    topics: input.topics,
  });
}

function findReplaceableLesson(blocks: readonly PlannedBlock[], lesson: PlannedBlock | undefined) {
  if (!lesson) {
    return;
  }

  const after = blocks.slice(blocks.indexOf(lesson) + 1);

  const needed = after.some(
    (block) =>
      isPhaseChallenge(block.payload.checkpoint) ||
      (block.payload.writingLessonId && block.payload.writingLessonId === lesson.lessonId),
  );

  return needed ? undefined : lesson;
}

function chooseTeaching({
  base,
  practiceMinutes,
  reviewMinutes,
  work,
}: {
  base: readonly PlannedBlock[];
  practiceMinutes: number;
  reviewMinutes: number;
  work: RemedialWork;
}) {
  const lessons = base.filter(
    (block) => block.kind === "learn" && !isOutsidePlanLesson(block.payload),
  );

  const last =
    work.dated || lessons.length <= 1 ? undefined : findReplaceableLesson(base, lessons.at(-1));

  const bossByLesson = new Map(
    base.filter((block) => block.payload.reinforcement).map((block) => [block.lessonId, block]),
  );

  const chosen = work.teaching.find((option) => {
    const lessonId = "lessonId" in option ? option.lessonId : null;
    const replacesBoss = lessonId && bossByLesson.get(lessonId);

    return (
      !lessons.some((lesson) => lessonId && lesson.lessonId === lessonId) &&
      option.estimatedMinutes <=
        practiceMinutes +
          reviewMinutes +
          (last?.estimatedMinutes ?? 0) +
          (replacesBoss ? replacesBoss.estimatedMinutes : 0)
    );
  });

  const followUp = chosen && "followUp" in chosen ? chosen.followUp : undefined;
  const teaching = chosen && "kind" in chosen ? chosen : undefined;
  const boss = teaching?.lessonId ? bossByLesson.get(teaching.lessonId) : undefined;

  const teachingMinutes = (teaching?.estimatedMinutes ?? 0) - (boss?.estimatedMinutes ?? 0);

  return { boss, followUp, last, teaching, teachingMinutes };
}

export function fundRemedialBlocks({
  blocks,
  budget,
  input,
  plannedMinutes,
  writingMinutes,
}: {
  blocks: PlannedBlock[];
  budget: number;
  input: SessionBuildInput;
  plannedMinutes: number;
  writingMinutes: number;
}): { blocks: PlannedBlock[]; plannedMinutes: number; remedialGeneration?: RemedialFollowUp } {
  const work = input.remedial;

  if (!work || sumMinutes(blocks) + writingMinutes > budget || input.fullReviewSkillIds) {
    return { blocks, plannedMinutes };
  }

  const review = blocks.find((block) => block.kind === "review");
  const reviewMinutes = review?.estimatedMinutes ?? 0;
  const protectedReview = getReviewMinutes(review?.payload.placementItemIds.length ?? 0, 0);
  const dueReview = reviewMinutes - protectedReview;
  const practice = blocks.filter((block) => block.kind === "practice");
  const practiceMinutes = sumMinutes(practice);
  const base = blocks.filter((block) => block.kind !== "review" && block.kind !== "practice");

  const {
    boss,
    followUp,
    last,
    teaching,
    teachingMinutes: newTeaching,
  } = chooseTeaching({ base, practiceMinutes, reviewMinutes: dueReview, work });

  const teachingMinutes = work.kept?.teaching ?? newTeaching;
  const remainingTeaching = Math.max(0, teachingMinutes - practiceMinutes);
  const replaceLesson = remainingTeaching > dueReview;
  const reviewForTeaching = Math.min(dueReview, remainingTeaching);

  // An unused review allocation can hold mistakes when the day has room.
  const unused = Math.max(0, budget - sumMinutes(blocks) - writingMinutes);
  const reviewCapMinutes = Math.ceil(getDailyReviewCap(input) * MINUTES_PER_REVIEW);
  const reviewSlack = Math.min(unused, Math.max(0, reviewCapMinutes - reviewMinutes));

  const mistakes = fitMistakes({
    input,
    minutes: dueReview - reviewForTeaching + reviewSlack,
    work,
  });

  const generation = followUp ? { remedialGeneration: followUp } : {};

  if (!work.kept && !teaching && mistakes.length === 0) {
    return { ...generation, blocks, plannedMinutes };
  }

  const mistakeMinutes = work.kept?.mistakes ?? sumMinutes(mistakes);

  const spentReview = Math.min(
    dueReview,
    reviewForTeaching + Math.max(0, mistakeMinutes - reviewSlack),
  );

  const keptReview = cutReview(review, spentReview);

  const keptPractice =
    teachingMinutes > 0
      ? shrinkPractice({
          blocks: practice,
          input,
          minutes: Math.max(0, practiceMinutes - teachingMinutes),
          reviewedSkillIds: keptReview.flatMap(({ payload }) => payload.skillIds),
        })
      : practice;

  const pending = blocks.filter(
    (block) => block.kind !== "review" && block !== boss && !(replaceLesson && block === last),
  );

  const firstPractice = practice[0];

  const result = [
    ...mistakes,
    ...keptReview,
    ...(teaching
      ? [{ ...teaching, payload: { ...teaching.payload, reinforcement: Boolean(boss) } }]
      : []),
    ...pending.flatMap((block) => {
      if (block.kind === "practice") {
        return block === firstPractice ? keptPractice : [];
      }

      return [block];
    }),
  ];

  return {
    ...generation,
    blocks: result,
    plannedMinutes: Math.max(
      plannedMinutes,
      sumMinutes(result) + (work.kept ? work.kept.mistakes + work.kept.teaching : 0),
    ),
  };
}
