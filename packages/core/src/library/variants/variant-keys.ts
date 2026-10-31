import { toSlug } from "@zoonk/utils/string";

const MAX_KEY_LENGTH = 40;

export function toVariantKey(value: string): string {
  return toSlug(value).slice(0, MAX_KEY_LENGTH);
}
