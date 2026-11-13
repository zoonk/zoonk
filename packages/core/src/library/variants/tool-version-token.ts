import { toVariantKey } from "./variant-keys";

export function getToolVersionToken({ key, stepId }: { key: string; stepId: string }) {
  return `tool-version:${stepId}:${toVariantKey(key)}`;
}
