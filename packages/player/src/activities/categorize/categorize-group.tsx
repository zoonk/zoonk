"use client";

import { AnswerOption } from "@zoonk/learn/answer-option";
import { CHIP_CLASS } from "@zoonk/learn/chip";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { getNumberKeyShortcut } from "../../player-shortcuts";

type Group = { id: string; label: string; rule: string };

const RULE_CLASS = "text-muted-foreground text-[0.8125rem] leading-snug font-normal";

function CategorizePreview({ latest, others }: { latest: string; others: number }) {
  const t = useExtracted();

  return (
    <span aria-hidden="true" className="mt-2 flex min-w-0 gap-1.5" data-slot="categorize-preview">
      <span
        className={cn(
          CHIP_CLASS,
          "bg-background text-foreground block min-w-0 shrink truncate text-xs leading-5.5 font-normal",
        )}
      >
        <LessonRichText text={latest} />
      </span>

      {others > 0 && (
        <span className={cn(CHIP_CLASS, "bg-background font-mono text-xs tabular-nums")}>
          {t({
            description:
              "On a group, beside the last card sorted into it: how many more cards it holds.",
            message: "+{count}",
            values: { count: String(others) },
          })}
        </span>
      )}
    </span>
  );
}

export function CategorizeGroupOption({
  group,
  index,
  latest,
  onSort,
  others,
}: {
  group: Group;
  index: number;
  latest: string | null;
  onSort: () => void;
  others: number;
}) {
  return (
    // A group sorts the card the moment it's pressed, so it's a plain button, not a radio to pick.
    <AnswerOption
      aria-checked={undefined}
      aria-keyshortcuts={getNumberKeyShortcut(index) ?? undefined}
      marker={index + 1}
      onClick={onSort}
      picked={false}
      role="button"
    >
      <span>
        <LessonRichText text={group.label} />
      </span>

      <span className={RULE_CLASS}>
        <LessonRichText text={group.rule} />
      </span>

      {latest && <CategorizePreview latest={latest} others={others} />}
    </AnswerOption>
  );
}

export function CategorizeGroupList({
  children,
  group,
  isEmpty,
}: {
  children: React.ReactNode;
  group: Group;
  isEmpty: boolean;
}) {
  const t = useExtracted();
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-option ring-input flex flex-col gap-0.5 px-3.5 py-3.25 ring-1 ring-inset"
      data-slot="categorize-group"
    >
      <h3 className="text-[0.9375rem] leading-6 font-medium" id={headingId}>
        <LessonRichText text={group.label} />
      </h3>

      <p className={RULE_CLASS}>
        <LessonRichText text={group.rule} />
      </p>

      {isEmpty ? (
        <p className={cn(RULE_CLASS, "mt-2")}>
          {t({
            description: "A group that holds no cards once every card is sorted.",
            message: "No cards here",
          })}
        </p>
      ) : (
        <ul className="bg-background ring-input mt-2.5 divide-y overflow-hidden rounded-lg ring-1">
          {children}
        </ul>
      )}
    </section>
  );
}
