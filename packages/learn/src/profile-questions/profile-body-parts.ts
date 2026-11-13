"use client";

import { type ProfileQuestionView } from "@zoonk/core/profile/questions/contract";
import { useExtracted } from "next-intl";
import {
  type ProfileDraft,
  type ProfileExclusive,
  toggleProfileExclusive,
  toggleProfilePick,
} from "./profile-draft";

export type BodyProps = {
  draft: ProfileDraft;
  memoryEnabled: boolean;
  onChange: (draft: ProfileDraft) => void;
  question: ProfileQuestionView;
};

export type Picker = {
  exclusive: (exclusive: ProfileExclusive) => void;
  toggle: (id: string) => void;
};

export function usePicker({ draft, onChange, question }: BodyProps): Picker {
  return {
    exclusive: (exclusive) => onChange(toggleProfileExclusive({ draft, exclusive })),
    toggle: (id) => onChange(toggleProfilePick({ draft, id, question: question.id }).draft),
  };
}

export function setText(props: BodyProps, text: string) {
  props.onChange({ ...props.draft, exclusive: null, text });
}

export function useExclusiveLabels() {
  const t = useExtracted();

  return {
    none: t({
      description: "An option that declines a question: none of the listed options apply.",
      message: "None of these",
    }),
    nothing: t("Nothing to add"),
    nothingInParticular: t("Nothing in particular"),
    ratherNot: t("I'd rather not say"),
  } satisfies Record<ProfileExclusive, string>;
}
