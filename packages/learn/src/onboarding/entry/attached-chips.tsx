"use client";

import { MAX_GOAL_SOURCES } from "@zoonk/core/goals/goal-input-limits";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleAlertIcon, FileTextIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ChangeSaveError } from "../../_components/save-error";
import { type StartAttachment } from "./material-goal";

function isUnreadable(item: StartAttachment): boolean {
  return Boolean(item.missing) || item.readStatus === "unreadable";
}

function ChipIcon({ item }: { item: StartAttachment }) {
  if (item.readStatus === "reading" && !item.missing) {
    return <Spinner aria-hidden="true" className="shrink-0" />;
  }

  const Icon = isUnreadable(item) ? CircleAlertIcon : FileTextIcon;
  return <Icon aria-hidden="true" className="size-4 shrink-0" />;
}

function useChipState(item: StartAttachment): string | null {
  const t = useExtracted();

  if (item.missing) {
    return t({
      description:
        "Read by screen readers after the name of an attached file that's gone, so it must be added again.",
      message: "Can't be read anymore",
    });
  }

  if (item.readStatus === "unreadable") {
    return t({
      description:
        "Read by screen readers after the name of an attached file, like a blurry photo of notes, where nothing could be read.",
      message: "Nothing on it could be read",
    });
  }

  return item.readStatus === "reading"
    ? t({
        description:
          "Read by screen readers after the name of an attached file, like a photo of notes, while it's still being read.",
        message: "Being read",
      })
    : null;
}

function AttachedChip({
  item,
  onRemove,
}: {
  item: StartAttachment;
  onRemove: (id: string) => void;
}) {
  const t = useExtracted();
  const title = item.title || t("Your text");
  const unreadable = isUnreadable(item);
  const state = useChipState(item);

  return (
    <li
      className={cn(
        "flex max-w-full items-center gap-1.5 rounded-md py-1 pr-1 pl-3 text-sm",
        unreadable ? "bg-destructive/10 text-destructive-text dark:bg-destructive/20" : "bg-muted",
      )}
    >
      <ChipIcon item={item} />
      <span className="truncate">{title}</span>
      {state && <span className="sr-only">{`, ${state}`}</span>}
      <Button
        aria-label={t("Remove {title}", { title })}
        className={cn(
          "size-7",
          unreadable && "hover:bg-destructive/20 hover:text-destructive-text",
        )}
        onClick={() => onRemove(item.id)}
        size="icon"
        variant="ghost"
      >
        <XIcon aria-hidden="true" />
      </Button>
    </li>
  );
}

function MissingLine({ items }: { items: StartAttachment[] }) {
  const t = useExtracted();
  const [only, ...others] = items;

  if (!only) {
    return null;
  }

  return others.length > 0
    ? t({
        description:
          "Under the learner's attached material when several items sent with their goal can't be read anymore.",
        message: "We can't read some of your files anymore. Remove them and add them again.",
      })
    : t({
        description:
          "Under the learner's attached material when one item sent with their goal can't be read anymore. {title} is its name, like \"Cell cycle.pdf\".",
        message: "We can't read “{title}” anymore. Remove it and add it again.",
        values: { title: only.title || t("Your text") },
      });
}

/** For files nothing could be read on; null when there are none. */
export function useNoWordsHint() {
  const t = useExtracted();

  return function noWordsHint(items: readonly { title: string }[]): string | null {
    const [only, ...others] = items;

    if (!only) {
      return null;
    }

    return others.length > 0
      ? t({
          description:
            "Under the learner's attached material when nothing could be read on several of their files, like blurry photos of notes. The files are marked in red above.",
          message: "We couldn't read these files. Try sharper photos or paste the text.",
        })
      : t({
          description:
            'Under the learner\'s attached material when nothing could be read on one file, like a blurry photo of notes. {title} is its name, like "Notes.jpg".',
          message: "We couldn't read “{title}”. Try a sharper photo or paste the text.",
          values: { title: only.title || t("Your text") },
        });
  };
}

function NoWordsLine({ items }: { items: StartAttachment[] }) {
  return useNoWordsHint()(items);
}

/** Gone files must be added again; files with nothing readable still go, so they get a hint instead. */
export function UnreadableNote({ items }: { items: StartAttachment[] }) {
  const missing = items.filter((item) => item.missing);
  const noWords = items.filter((item) => !item.missing && item.readStatus === "unreadable");

  if (missing.length === 0 && noWords.length === 0) {
    return null;
  }

  return (
    <ChangeSaveError>
      <MissingLine items={missing} /> <NoWordsLine items={noWords} />
    </ChangeSaveError>
  );
}

export function AttachedChips({
  items,
  onRemove,
}: {
  items: StartAttachment[];
  onRemove: (id: string) => void;
}) {
  const t = useExtracted();

  return (
    <>
      <ul aria-label={t("Your material")} className="flex flex-wrap gap-2">
        {items.map((item) => (
          <AttachedChip item={item} key={item.id} onRemove={onRemove} />
        ))}
      </ul>

      {items.length >= MAX_GOAL_SOURCES && (
        <p className="text-muted-foreground text-sm" role="status">
          {t({
            description:
              "Under the learner's attached files on Start when they've added as many as a goal can use, so the paperclip is off. {count} is that limit, like 5.",
            message: "{count, number} files is the most for one goal. Remove one to add another.",
            values: { count: MAX_GOAL_SOURCES },
          })}
        </p>
      )}
    </>
  );
}
