"use client";

import { undoMemoryChangesAction } from "@/app/[lang]/(settings)/settings/memory/actions";
import { Link } from "@/i18n/navigation";
import { getWorkflowAuthHeaders } from "@/lib/workflow/auth-headers";
import { MemoryUpdated } from "@zoonk/learn/memory-updated";
import { type LessonTutorConfig } from "@zoonk/player/lesson/types";
import { API_URL } from "@zoonk/utils/url";

type TutorNavigation = LessonTutorConfig["navigation"];

const renderMemoryUpdate: NonNullable<TutorNavigation["renderMemoryUpdate"]> = (changes) => (
  <MemoryUpdated changes={changes} className="mt-2" onUndo={undoMemoryChangesAction} />
);

/**
 * The tutor in a lesson or on a screen (a chapter, course, plan or mock), over the public API:
 * the learner's buddy answers, by face and name (`getLearnerBuddy`; null before they pick one).
 * Signed-in learners ask; visitors and guests see the sign-up prompt, since the tutor isn't part
 * of a guest's allowance.
 */
export function getTutorConfig({
  buddy,
  canAsk,
}: {
  buddy: LessonTutorConfig["buddy"];
  canAsk: boolean;
}): LessonTutorConfig {
  return {
    buddy,
    canAsk,
    connection: { apiUrl: API_URL, getHeaders: getWorkflowAuthHeaders },
    navigation: {
      linkComponent: Link,
      loginHref: "/login",
      renderMemoryUpdate,
      subscriptionHref: "/subscription",
    },
  };
}
