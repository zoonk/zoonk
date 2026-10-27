"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  ListRow,
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { type useMissionOpen } from "./mission-links";

/**
 * "1/3": how many of a list's items are done, in the mono face as every count is; screen readers
 * hear "1 of 3".
 */
export function ProgressCount({ done, total }: { done: number; total: number }) {
  const t = useExtracted();
  const complete = String(done);

  return (
    <>
      <span aria-hidden="true">{`${complete}/${total}`}</span>
      <span className="sr-only">
        {t("{complete} of {total}", { complete, total: String(total) })}
      </span>
    </>
  );
}

/**
 * One row of the buddy's lists (today's missions, the first steps): its mark, its name with its
 * state for screen readers, one line under it, an optional count at its end, and the whole row
 * opening where it's done (`target`); a row with nowhere to open only shows. A row that opens is
 * named by its words, as every list row is ("Review, go to today's review, Quick review · 1 min"):
 * a label of its own would leave out the words on screen, which voice control users say to press
 * it.
 */
export function MissionListRow({
  detail,
  mark,
  muted,
  name,
  stateLabel,
  target,
  trailing,
}: {
  detail: React.ReactNode;
  mark: React.ReactNode;
  muted: boolean;
  name: string;
  stateLabel: string | undefined;
  target: ReturnType<typeof useMissionOpen>;
  /** A multi-step mission's count ("1/3"), before the row's chevron. */
  trailing?: React.ReactNode;
}) {
  const content = (
    <>
      <ListRowLeading className="w-3 justify-center">{mark}</ListRowLeading>
      <ListRowContent>
        <ListRowTitle className={cn(muted && "text-muted-foreground")}>
          {name}
          {stateLabel && <span className="sr-only">{stateLabel}</span>}
        </ListRowTitle>
        {detail && <ListRowDescription className="empty:hidden">{detail}</ListRowDescription>}
      </ListRowContent>
      {trailing && <ListRowTrailing>{trailing}</ListRowTrailing>}
    </>
  );

  if (!target) {
    return <ListRow>{content}</ListRow>;
  }

  if ("href" in target) {
    return (
      <ListRowLink href={target.href} onClick={target.onOpen} prefetch={target.prefetch}>
        {content}
      </ListRowLink>
    );
  }

  return (
    <ListRowButton
      aria-busy={target.pending || undefined}
      className="aria-busy:opacity-60"
      disabled={target.pending}
      onClick={target.open}
    >
      {content}
    </ListRowButton>
  );
}
