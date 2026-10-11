import { checkChallengeAfterLessons } from "./challenge-rules";
import { checkCardMatchesPlan } from "./change-truth-rules";
import {
  checkNoRegeneration,
  checkSharedContentKept,
  checkSharedPromptsImpersonal,
} from "./content-rules";
import {
  checkDayBeforeTest,
  checkDayOneHasSession,
  checkDayOneOpensWithGaps,
  checkMocksInEveryPhase,
  checkPhasesInOrder,
  checkRestDaysRest,
} from "./day-rules";
import {
  checkBaseChoicesKeepTopics,
  checkEverythingPlanned,
  checkOutcomesKept,
  checkPrerequisitesFirst,
  checkWrittenTestsKept,
} from "./keep-rules";
import {
  checkKnownGetsPractice,
  checkKnownHasEvidence,
  checkListeningOnlyRecorded,
  checkMissBringsLessonsBack,
} from "./known-rules";
import { checkLandingMovesOnlyLanded } from "./landing-rules";
import { checkMostAskedKept } from "./most-asked-rules";
import { checkDeclinedNotReoffered } from "./proposal-rules";
import {
  checkCoverageShown,
  checkReadinessHonest,
  checkScoreEstimateEarned,
} from "./readiness-rules";
import { checkFinishedLessonsComeBack } from "./review-rules";
import { type RuleContext, type RuleViolation } from "./rule-context";
import {
  checkCoverageTrue,
  checkNoEmDashes,
  checkNoPromises,
  checkRecommendedTimeCovers,
} from "./shown-rules";
import {
  checkChangesSaid,
  checkPhaseEndsKept,
  checkRefreshChangesNothing,
  checkTodayKept,
  checkUndoRestores,
} from "./stability-rules";
import {
  checkFocusKeepsArea,
  checkReduceTakesFromArea,
  checkSteeringKeepsToday,
} from "./steering-rules";
import { checkChapterInProgressKept, checkFinishedKept, checkUnfinishedKept } from "./work-rules";

/** Every rule of RULES.md with a check, by number (R9 is covered by R6 and R8). */
const RULE_CHECKS: readonly ((context: RuleContext) => RuleViolation[])[] = [
  checkFocusKeepsArea,
  checkReduceTakesFromArea,
  checkCardMatchesPlan,
  checkSteeringKeepsToday,
  checkChangesSaid,
  checkPhaseEndsKept,
  checkTodayKept,
  checkUnfinishedKept,
  checkFinishedKept,
  checkChapterInProgressKept,
  checkMostAskedKept,
  checkWrittenTestsKept,
  checkOutcomesKept,
  checkEverythingPlanned,
  checkBaseChoicesKeepTopics,
  checkPrerequisitesFirst,
  checkKnownHasEvidence,
  checkKnownGetsPractice,
  checkMissBringsLessonsBack,
  checkDayOneHasSession,
  checkRestDaysRest,
  checkDayOneOpensWithGaps,
  checkDayBeforeTest,
  checkMocksInEveryPhase,
  checkCoverageTrue,
  checkRecommendedTimeCovers,
  checkNoEmDashes,
  checkNoPromises,
  checkSharedContentKept,
  checkSharedPromptsImpersonal,
  checkNoRegeneration,
  checkRefreshChangesNothing,
  checkDeclinedNotReoffered,
  checkCoverageShown,
  checkReadinessHonest,
  checkScoreEstimateEarned,
  checkListeningOnlyRecorded,
  checkUndoRestores,
  checkPhasesInOrder,
  checkChallengeAfterLessons,
  checkLandingMovesOnlyLanded,
  checkFinishedLessonsComeBack,
];

/**
 * The shared content rules, the only ones a step that isn't the plan's reads: deleting the account
 * or changing a prompt passes the last plan as it was, without the proposals or texts a plan's
 * own step carries, so the plan's checks would judge it again with less to read.
 */
const CONTENT_CHECKS: readonly ((context: RuleContext) => RuleViolation[])[] = [
  checkSharedContentKept,
  checkSharedPromptsImpersonal,
  checkNoRegeneration,
];

/**
 * Runs every rule's check on one step of a learner's life (see RULES.md). Each check finds nothing
 * when the step doesn't carry what it reads, so a caller passes what it has.
 */
export function checkRules(context: RuleContext): RuleViolation[] {
  const isContentStep = ["accountDeleted", "promptChanged"].includes(context.event.kind);
  return (isContentStep ? CONTENT_CHECKS : RULE_CHECKS).flatMap((check) => check(context));
}
