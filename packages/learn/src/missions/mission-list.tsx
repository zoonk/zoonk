"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  ListRow,
  ListRowBody,
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { StepOpenFailed } from "../_components/step-open-failed";
import { type useMissionOpen } from "./mission-links";

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
 * Named by its words on screen, which voice control users say to press it; a label of its own would
 * leave them out.
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
  trailing?: React.ReactNode;
}) {
  const content = (
    <>
      <ListRowLeading className="w-3 justify-center">{mark}</ListRowLeading>
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle className={cn(muted && "text-muted-foreground")}>
            {name}
            {stateLabel && <span className="sr-only">{stateLabel}</span>}
          </ListRowTitle>
          {detail && <ListRowDescription className="empty:hidden">{detail}</ListRowDescription>}
        </ListRowContent>
        {trailing && <ListRowTrailing>{trailing}</ListRowTrailing>}
      </ListRowBody>
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
    <>
      <ListRowButton
        aria-busy={target.pending || undefined}
        disabled={target.pending}
        onClick={target.open}
      >
        {content}
      </ListRowButton>

      {target.failed && <StepOpenFailed className="-mt-0.5 pb-2.75 pl-6" />}
    </>
  );
}
