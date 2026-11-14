"use client";

import {
  type ProfileAnswerInput,
  type ProfileQuestionView,
} from "@zoonk/core/profile/questions/contract";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted } from "next-intl";
import { useId, useState, useTransition } from "react";
import { EnterButton } from "../_components/enter-button";
import {
  PageHeader,
  PageHeaderContent,
  PageSubtitle,
  PageTitle,
  SECTION_SUBPAGE_TITLE_CLASS,
} from "../_components/page";
import { CLEAR_OF_PINNED_ACTIONS_CLASS } from "../_components/pinned-actions";
import { useChangeSaveFailed } from "../_components/save-error";
import { canSendProfileDraft, toProfileAnswer, toProfileDraft } from "./profile-draft";
import { ProfileQuestionBody } from "./profile-question-body";
import { useProfileQuestionDescription, useProfileQuestionTitle } from "./profile-question-copy";

const QUESTION_COLUMN_CLASS = "flex flex-col gap-6";

/** Sized to a one-line title and description, the length most questions have. */
export function AboutYouQuestionSkeleton() {
  return (
    <div className={QUESTION_COLUMN_CLASS}>
      <PageHeader>
        <PageHeaderContent className="flex-1">
          <div className={cn("text-title", SECTION_SUBPAGE_TITLE_CLASS)}>
            <Skeleton className="h-lh w-3/4" />
          </div>
          <PageSubtitle>
            <Skeleton className="h-5 w-full" />
          </PageSubtitle>
        </PageHeaderContent>
      </PageHeader>

      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

export function AboutYouQuestionScreen({
  memoryEnabled,
  onSave,
  question,
}: {
  memoryEnabled: boolean;
  /** Resolves whether it saved; the host leaves the page once it has. */
  onSave: (input: ProfileAnswerInput) => Promise<boolean>;
  question: ProfileQuestionView;
}) {
  const t = useExtracted();
  const title = useProfileQuestionTitle(question.id);
  const description = useProfileQuestionDescription(question.id);
  const [draft, setDraft] = useState(() => toProfileDraft(question));
  const saveFailed = useChangeSaveFailed();
  const [isPending, startTransition] = useTransition();
  const formId = useId();

  const input = canSendProfileDraft({ draft, from: "settings", question: question.id })
    ? toProfileAnswer({ draft, memoryEnabled, question: question.id })
    : null;

  return (
    <>
      <form
        className={cn(QUESTION_COLUMN_CLASS, CLEAR_OF_PINNED_ACTIONS_CLASS)}
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();

          if (!input || isPending) {
            return;
          }

          startTransition(async () => {
            const { data: saved } = await safeAsync(() => onSave(input));

            if (!saved) {
              saveFailed();
            }
          });
        }}
      >
        <PageHeader>
          <PageHeaderContent>
            <PageTitle className={SECTION_SUBPAGE_TITLE_CLASS}>{title}</PageTitle>
            {description && <PageSubtitle>{description}</PageSubtitle>}
          </PageHeaderContent>
        </PageHeader>

        <ProfileQuestionBody
          draft={draft}
          label={title}
          memoryEnabled={memoryEnabled}
          onChange={setDraft}
          question={question}
        />
      </form>

      <BottomBar>
        <BottomBarActions>
          <EnterButton busy={isPending} disabled={!input} form={formId} type="submit">
            {t("Save")}
          </EnterButton>
        </BottomBarActions>
      </BottomBar>
    </>
  );
}
