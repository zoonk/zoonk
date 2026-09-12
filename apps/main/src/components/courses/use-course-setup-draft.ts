"use client";

import { type CoursePlanInput } from "@zoonk/core/courses/learning-plan-contract";
import { useEffect, useState } from "react";
import { z } from "zod";

const MAX_GOAL_LENGTH = 4000;
const MAX_GOAL_DETAIL_LENGTH = 3500;
const MAX_LEVEL_LENGTH = 20;

const draftSchema = z.object({
  depth: z.enum(["overview", "complete", "focused"]).optional(),
  goal: z.string().max(MAX_GOAL_LENGTH),
  goalDetail: z.string().max(MAX_GOAL_DETAIL_LENGTH).default(""),
  startingLevel: z.string().max(MAX_LEVEL_LENGTH),
});

type SetupDraft = z.infer<typeof draftSchema>;

function readDraft(key: string): SetupDraft | null {
  try {
    const saved = sessionStorage.getItem(key);
    const parsed = draftSchema.safeParse(saved ? JSON.parse(saved) : null);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function useCourseSetupDraft({
  courseId,
  defaultInput,
}: {
  courseId: string;
  defaultInput?: CoursePlanInput;
}) {
  const [draft, setDraft] = useState<SetupDraft>({
    depth: defaultInput?.depth,
    goal: defaultInput?.goal ?? "",
    goalDetail: "",
    startingLevel: defaultInput?.startingLevel ?? "",
  });

  const draftKey = `course-setup:${courseId}`;

  useEffect(() => {
    if (defaultInput) {
      return;
    }

    const saved = readDraft(draftKey);

    if (saved) {
      // oxlint-disable-next-line react/set-state-in-effect -- Synchronize the browser's saved draft after hydration; server rendering cannot read sessionStorage.
      setDraft(saved);
    }
  }, [defaultInput, draftKey]);

  function updateDraft(update: Partial<SetupDraft>) {
    const next = { ...draft, ...update };
    setDraft(next);

    try {
      sessionStorage.setItem(draftKey, JSON.stringify(next));
    } catch {
      /** Choices still work when browser session storage is unavailable. */
    }
  }

  return { draft, updateDraft };
}
