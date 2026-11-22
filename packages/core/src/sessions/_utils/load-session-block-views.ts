import "server-only";
import { type ExamBlueprint } from "@zoonk/db";
import { loadOftenTestedSkillIds } from "../../exams/map/load-often-tested";
import { type SavedPlan, readSavedPlan } from "../../learner/facts/saved-plan";
import { loadBlockedTestOutChapters } from "../../learner/test-out/_utils/offer-eligibility";
import { readBlockPayload } from "../block-payload";
import { loadBlockSubjects } from "./block-subjects";
import { isCurrentSession } from "./current-session";
import { type LessonStatesReader, readLessonScreens } from "./lesson-screens";
import { loadPreparingMockPositions } from "./preparing-mock-blocks";
import { type SessionAnswer, loadSessionAnswers } from "./session-answers";
import { toStudyBlockViews } from "./session-view";
import { type StudySessionRow } from "./study-session-access";

export async function loadSessionBlockViews({
  answers: knownAnswers,
  blueprint,
  plan,
  preparing: knownPreparing,
  readLessonStates,
  session,
  timeZone,
  userId,
}: {
  answers?: readonly SessionAnswer[];
  blueprint?: ExamBlueprint | null;
  preparing?: ReadonlySet<number>;
  plan?: SavedPlan | null;
  readLessonStates?: LessonStatesReader;
  session: StudySessionRow;
  timeZone: string;
  userId: string;
}) {
  const now = new Date();

  const [answers, subjects, blockedChapters, oftenTestedSkillIds, preparing] = await Promise.all([
    knownAnswers ?? loadSessionAnswers({ blocks: session.blocks, sessionId: session.id, userId }),
    loadBlockSubjects({ blocks: session.blocks, blueprint, goal: session.goal }),
    session.goalId
      ? loadBlockedTestOutChapters({
          chapterIds: [
            ...new Set(session.blocks.flatMap((block) => readBlockPayload(block).chapterId ?? [])),
          ],
          goalId: session.goalId,
          known: {
            blueprint,
            goal: session.goal,
            source: plan === undefined ? readSavedPlan(userId, session.goalId) : plan,
          },
          now,
          timeZone,
          userId,
        })
      : new Set<string>(),
    loadOftenTestedSkillIds(session.goal),
    knownPreparing ?? loadPreparingMockPositions({ ...session, blueprint }),
  ]);

  const current = isCurrentSession({ now, session, timeZone });

  const { blocks } = await readLessonScreens(
    {
      blocks: toStudyBlockViews({
        answers,
        blockedTestOutChapters: blockedChapters,
        blocks: session.blocks,
        oftenTestedSkillIds,
        preparing,
        subjects,
      }),
      current,
      status: session.status,
    },
    readLessonStates,
  );

  return { answers, blocks, current, displayBlocks: session.blocks, preparing };
}
