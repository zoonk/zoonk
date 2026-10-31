"use client";

import { useExtracted } from "next-intl";

export function useResumeEffectText() {
  const t = useExtracted();

  return t(
    "Your plan picks up from today, starting with the lessons planned for the days you paused.",
  );
}

export function ResumeEffect({ preview }: { preview: boolean }) {
  const text = useResumeEffectText();
  return preview ? <p className="text-muted-foreground text-sm text-pretty">{text}</p> : null;
}
