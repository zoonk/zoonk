import {
  type PublishedDraftOutcome,
  type PublishedLessonOutcome,
  checkPublishedDraft,
  fixPublishedDraft,
  stagePublishedDraft,
} from "../library/quality/published-lesson-check";

export async function settlePublishedDraft(
  outcome: PublishedDraftOutcome,
): Promise<PublishedLessonOutcome> {
  if (outcome.status === "drafted") {
    return settlePublishedDraft(await checkPublishedDraft({ state: outcome.state }));
  }

  if (outcome.status === "needsFix") {
    const state = await fixPublishedDraft({ first: outcome.first, state: outcome.state });
    return settlePublishedDraft(await checkPublishedDraft({ fixed: true, state }));
  }

  if (outcome.status === "checked") {
    return stagePublishedDraft(outcome);
  }

  return outcome;
}
