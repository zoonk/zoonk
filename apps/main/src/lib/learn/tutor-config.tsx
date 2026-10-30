"use client";

import { undoMemoryChangesAction } from "@/app/[lang]/(app)/(settings)/settings/memory/actions";
import { useSignUpHref } from "@/components/learn/use-sign-up-href";
import { Link } from "@/i18n/navigation";
import { getBrowserApiUrl } from "@/lib/browser-api-url";
import { getWorkflowAuthHeaders } from "@/lib/workflow/auth-headers";
import { MemoryUpdated } from "@zoonk/learn/memory-updated";
import { type LessonTutorConfig } from "@zoonk/player/lesson/types";
import { useMemo } from "react";
import { type MainTutorCards } from "./use-tutor-cards";

type TutorNavigation = LessonTutorConfig["navigation"];

const renderMemoryUpdate: NonNullable<TutorNavigation["renderMemoryUpdate"]> = (changes) => (
  <MemoryUpdated changes={changes} className="mt-2" onUndo={undoMemoryChangesAction} />
);

/** Visitors and guests see the sign-up prompt: the tutor isn't part of a guest's allowance. */
export function useTutorConfig({
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
  const loginHref = useSignUpHref();

  return useMemo(
    () => ({
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
        loginHref,
        renderMemoryUpdate,
        subscriptionHref: "/subscription",
      },
      suggestions,
    }),
    [appLinks, buddy, canAsk, cards, loginHref, suggestions],
  );
}
