"use client";

import { undoMemoryChangesAction } from "@/app/[lang]/(app)/(settings)/settings/memory/actions";
import { Link } from "@/i18n/navigation";
import { getBrowserApiUrl } from "@/lib/browser-api-url";
import { getWorkflowAuthHeaders } from "@/lib/workflow/auth-headers";
import { MemoryUpdated } from "@zoonk/learn/memory-updated";
import { type LessonTutorConfig } from "@zoonk/player/lesson/types";
import { type MainTutorCards } from "./use-tutor-cards";

type TutorNavigation = LessonTutorConfig["navigation"];

const renderMemoryUpdate: NonNullable<TutorNavigation["renderMemoryUpdate"]> = (changes) => (
  <MemoryUpdated changes={changes} className="mt-2" onUndo={undoMemoryChangesAction} />
);

/**
 * The tutor in a lesson or on a screen (a chapter, course, plan or mock), over the public API:
 * the learner's buddy answers, by face and name (`getLearnerBuddy`, including the default).
 * Signed-in learners ask; visitors and guests see the sign-up prompt, since the tutor isn't part
 * of a guest's allowance. Inside a goal, its answers carry the buddy's cards and link the app
 * (`useTutorCards`); the buddy's tab draws its own cards and passes only `appLinks`.
 */
export function getTutorConfig({
  appLinks,
  buddy,
  canAsk,
  cards = null,
  suggestions,
}: {
  appLinks?: TutorNavigation["appLinks"];
  buddy: LessonTutorConfig["buddy"];
  canAsk: boolean;
  cards?: MainTutorCards | null;
  suggestions?: LessonTutorConfig["suggestions"];
}): LessonTutorConfig {
  return {
    buddy,
    canAsk,
    connection: {
      get apiUrl() {
        return getBrowserApiUrl();
      },
      getHeaders: getWorkflowAuthHeaders,
    },
    navigation: {
      appLinks,
      ...cards,
      linkComponent: Link,
      loginHref: "/login",
      renderMemoryUpdate,
      subscriptionHref: "/subscription",
    },
    suggestions,
  };
}
