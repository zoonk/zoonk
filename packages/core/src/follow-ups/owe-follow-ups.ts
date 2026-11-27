import "server-only";
import { createHash } from "node:crypto";
import { type TransactionClient, prisma } from "@zoonk/db";
import { after } from "next/server";
import { type FollowUp } from "./follow-up-contract";
import { startFollowUps } from "./follow-up-starter";

// oxlint-disable-next-line complexity -- Each follow-up kind names its persisted deduplication key.
function getFollowUpKey(followUp: FollowUp): string {
  switch (followUp.kind) {
    case "refreshStudyDay":
    case "prepareSession":
    case "settleSessionPlan":
      return followUp.input.sessionId;
    case "settleSessionDay":
      return followUp.input.blockId ?? followUp.input.removalId ?? followUp.input.sessionId;
    case "prepareMockSupply":
    case "refreshPlanSuggestion":
    case "rebuildGoalCurriculum":
    case "rememberOnboarding":
      return followUp.input.goalId;
    case "prepareGoalLessons":
    case "prepareLevelTestBank":
      return followUp.input.goalId;
    case "replenishLevelTestChecks":
      return `${followUp.input.goalId}:${followUp.input.level}`;
    case "prepareLevelTestOut":
      return followUp.input.attemptId;
    case "preparePlacementItems":
      return followUp.input.goalId;
    case "writeLesson":
    case "writeSentenceOrders":
      return followUp.input.lessonId;
    case "prepareContentFixMedia":
    case "voiceContentFix":
      return followUp.input.fixId;
    // An admitted run is owed apart from an ask, so an ask from a write that read the map before
    // the admission committed can't replace the run the learner was charged for.
    case "makeChapterMindMap":
      return followUp.input.launch
        ? `${followUp.input.chapterId}:launch`
        : followUp.input.chapterId;
    case "classifyMistakeCause":
      return followUp.input.mistakeId;
    case "findMistakePattern":
      return followUp.input.language;
    case "rememberSession":
      return followUp.input.sessionId;
    case "checkDailyInsight":
      return followUp.input.date;
    case "checkFactSensitivity": {
      const wording = createHash("sha1").update(followUp.input.statement).digest("hex");
      return `${followUp.input.factId}:${wording}`;
    }
    case "voiceWord":
      return followUp.input.wordId;
    case "updateLessonsShowing":
      return followUp.input.id;
    case "writeSpeakingPaper":
      return followUp.input.mockId;
    case "reviewAlphabetLesson":
      return `${followUp.input.lessonId}:${followUp.input.version}`;
    case "answerResearchUpload":
      return followUp.input.answerId;
    case "checkUploadVisibility":
    case "readUpload":
      return followUp.input.sourceId;
    case "endWebPlusBesideStore":
      return "webPlus";
    case "suggestProfileTools":
      return "profile";
    case "askToCancelSecondStorePlus":
      return followUp.input.subscriptionId;
    default:
      return followUp satisfies never;
  }
}

function askFor({
  db,
  followUp,
  requestedAt,
  userId,
}: {
  db: TransactionClient;
  followUp: FollowUp;
  requestedAt: Date;
  userId: string;
}) {
  const { input, kind } = followUp;
  const key = getFollowUpKey(followUp);

  return db.followUp.upsert({
    create: { input, key, kind, requestedAt, userId },
    update: { failedAt: null, input, requestedAt, revision: { increment: 1 } },
    where: { userKindKey: { key, kind, userId } },
  });
}

type FollowUpRequest = { db?: TransactionClient; followUps: readonly FollowUp[]; userId: string };

/**
 * Pass the transaction that decides the write, so a rolled-back write owes nothing. The same work
 * still pending is asked again instead of added twice. `userId` must come from the capability that
 * authorized the write.
 */
export async function recordFollowUps({
  db = prisma,
  followUps,
  userId,
}: FollowUpRequest): Promise<void> {
  if (followUps.length === 0) {
    return;
  }

  const requestedAt = new Date();

  await Promise.all(followUps.map((followUp) => askFor({ db, followUp, requestedAt, userId })));
}

export async function oweFollowUps(request: FollowUpRequest): Promise<void> {
  await recordFollowUps(request);

  if (request.followUps.length > 0) {
    after(() => startFollowUps(request.userId));
  }
}
