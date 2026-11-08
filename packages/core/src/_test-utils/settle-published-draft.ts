import {
  type PublishedDraftOutcome,
  type PublishedLessonOutcome,
  checkPublishedDraft,
  fixPublishedDraft,
  recheckPublishedDraft,
  stagePublishedDraft,
} from "../library/quality/published-lesson-check";

export async function settlePublishedDraft(
  outcome: PublishedDraftOutcome,
): Promise<PublishedLessonOutcome> {
  const checked =
    outcome.status === "drafted" ? await checkPublishedDraft({ state: outcome.state }) : outcome;

  if (checked.status === "checked") {
    return stagePublishedDraft(checked);
  }

  if (checked.status !== "needsFix") {
    return checked;
  }

  const fixed = await fixPublishedDraft({ first: checked.first, state: checked.state });

  if (fixed.status === "passed") {
    return fixed;
  }

  const rechecked = await recheckPublishedDraft({ state: fixed.state });
  return rechecked.status === "checked" ? stagePublishedDraft(rechecked) : rechecked;
}
