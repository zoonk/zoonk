import { removeAccents } from "@zoonk/ui/lib/utils";

export function normalizeString(str: string): string {
  return removeAccents(str).toLowerCase().replace(/\s+/g, " ").trim();
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
