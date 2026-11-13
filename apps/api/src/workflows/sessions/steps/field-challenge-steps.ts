import {
  finishFieldChallengeDraft,
  prepareFieldChallengeDraft,
} from "@zoonk/core/library/challenges/field-challenge";

export async function prepareFieldChallengeDraftStep(
  input: Parameters<typeof prepareFieldChallengeDraft>[0],
) {
  "use step";
  return prepareFieldChallengeDraft(input);
}

export async function finishFieldChallengeDraftStep(
  input: Parameters<typeof finishFieldChallengeDraft>[0],
) {
  "use step";
  return finishFieldChallengeDraft(input);
}
