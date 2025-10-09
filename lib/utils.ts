import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeString(str: string): string {
  return removeAccents(str).toLowerCase().replace(/\s+/g, " ").trim();
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function repairAIText({
  text,
  error,
  context,
}: {
  text: string;
  error: unknown;
  context?: string;
}): Promise<string> {
  const { jsonrepair } = await import("jsonrepair");

  if (context) {
    console.error(`[AI Text Repair] ${context}:`, error);
  } else {
    console.error("[AI Text Repair]:", error);
  }

  return jsonrepair(text);
}
