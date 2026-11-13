import { toVariantKey } from "../variants/variant-keys";

export function getFieldChallengeToken({ field, stepId }: { field: string; stepId: string }) {
  return `field-challenge:${stepId}:${toVariantKey(field)}`;
}
