"use client";

import { MAX_TYPED_PLACEMENT_ANSWER_LENGTH } from "@zoonk/core/learner/placement/placement-limits";
import { Label } from "@zoonk/ui/components/label";
import { Textarea } from "@zoonk/ui/components/textarea";
import { useExtracted } from "next-intl";
import { useId } from "react";

export function TypedAnswerField({
  onChange,
  onSubmit,
  value,
}: {
  onChange: (value: string) => void;
  onSubmit: () => void;
  value: string;
}) {
  const t = useExtracted();
  const fieldId = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId}>{t("Your answer, in your own words")}</Label>
      <Textarea
        autoFocus
        className="min-h-28 text-base"
        id={fieldId}
        maxLength={MAX_TYPED_PLACEMENT_ANSWER_LENGTH}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onSubmit();
          }
        }}
        value={value}
      />
    </div>
  );
}
