"use client";

import {
  type ProfileAnswerInput,
  type ProfileQuestionView,
} from "@zoonk/core/profile/questions/contract";
import { Button } from "@zoonk/ui/components/button";
import { safeAsync } from "@zoonk/utils/error";
import { CheckIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { PageHeader, PageHeaderContent, PageSubtitle, PageTitle } from "../_components/page";
import { ChangeSaveError } from "../_components/save-error";
import { canSendProfileDraft, toProfileAnswer, toProfileDraft } from "./profile-draft";
import { ProfileQuestionBody } from "./profile-question-body";
import { useProfileQuestionDescription, useProfileQuestionTitle } from "./profile-question-copy";

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
  const description = useProfileQuestionDescription({ question: question.id });
  const [draft, setDraft] = useState(() => toProfileDraft(question));
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const input = canSendProfileDraft({ draft, from: "settings", question: question.id })
    ? toProfileAnswer({ draft, memoryEnabled, question: question.id })
    : null;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();

        if (!input || isPending) {
          return;
        }

        setFailed(false);

        startTransition(async () => {
          const { data: saved } = await safeAsync(() => onSave(input));
          setFailed(!saved);
        });
      }}
    >
      <PageHeader>
        <PageHeaderContent>
          <PageTitle>{title}</PageTitle>
          <PageSubtitle>{description}</PageSubtitle>
        </PageHeaderContent>
      </PageHeader>

      <ProfileQuestionBody
        draft={draft}
        label={title}
        memoryEnabled={memoryEnabled}
        onChange={setDraft}
        question={question}
      />

      {failed && <ChangeSaveError />}

      <div className="flex">
        <Button
          busy={isPending}
          disabled={!input}
          icon={<CheckIcon aria-hidden="true" />}
          type="submit"
        >
          {t("Save")}
        </Button>
      </div>
    </form>
  );
}
