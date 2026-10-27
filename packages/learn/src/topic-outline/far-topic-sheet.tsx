"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { Spinner } from "@zoonk/ui/components/spinner";
import { useExtracted } from "next-intl";
import { type ReactElement, type ReactNode, useRef, useState } from "react";
import { DrawerCloseButton } from "../_components/details-drawer";
import { OutlineLimitNotice } from "../_components/help-limit-notice";
import { ListGroup, ListRowContent, ListRowLink, ListRowTitle } from "../_components/list-group";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";
import { type TopicOutlineActions } from "./topic-outline-actions";
import { useFarTopicLine } from "./use-far-topic-line";
import { type TopicOutlineShown, useTopicOutline } from "./use-topic-outline";

const TEXT_CLASS = "text-muted-foreground text-sm text-pretty";

/** What the sheet says before the tap, while the lessons are written, and when they can't be. */
function useStateCopy(shown: TopicOutlineShown): { action: string | null; message: string } {
  const t = useExtracted();

  if (shown === "writing") {
    return { action: null, message: t("Preparing the lessons… It takes about half a minute.") };
  }

  if (shown === "unreachable") {
    return {
      action: t("Try again"),
      message: t("We couldn't reach the server. Check your connection."),
    };
  }

  if (shown === "unavailable") {
    return { action: null, message: t("There's nothing left to prepare for this topic.") };
  }

  return {
    action: t("See the lessons"),
    message: t(
      "A topic's lessons are planned two weeks before you get to it. You can see this one's now.",
    ),
  };
}

/** The topic's chapters once written, each opening its page. */
function OutlineChapters({
  chapterHref,
  chapters,
}: {
  chapterHref: (chapterId: string) => string;
  chapters: { chapterId: string; title: string }[];
}) {
  return (
    <ListGroup>
      {chapters.map((chapter) => (
        <ListRowLink href={chapterHref(chapter.chapterId)} key={chapter.chapterId}>
          <ListRowContent className="min-h-12 py-2.5">
            <ListRowTitle className="line-clamp-2">{chapter.title}</ListRowTitle>
          </ListRowContent>
        </ListRowLink>
      ))}
    </ListGroup>
  );
}

/** The sheet's body: the tap that writes the lessons, its wait, then the chapters. */
function FarTopicBody({
  actions,
  chapterHref,
  onLanded,
  open,
  skillId,
}: {
  actions: TopicOutlineActions;
  chapterHref: (chapterId: string) => string;
  onLanded: () => void;
  open: boolean;
  skillId: string;
}) {
  const routes = useLearnRoutes();

  const { chapters, isPending, limit, request, retry, shown } = useTopicOutline({
    actions,
    onLanded,
    open,
    skillId,
  });

  const copy = useStateCopy(shown);

  if (shown === "loading") {
    return <Spinner className="text-muted-foreground mx-auto my-6 size-5" />;
  }

  if (shown === "ready" && chapters.length > 0) {
    return <OutlineChapters chapterHref={chapterHref} chapters={chapters} />;
  }

  // A cap reached keeps the button in sight, disabled, with the notice's one thing to do under it.
  const isCapped = limit !== null && limit.status !== "slowDown";
  const isFailure = shown === "unreachable";

  return (
    <div className="flex flex-col gap-4" data-slot="far-topic">
      <div className="flex items-start gap-3" role={shown === "writing" ? "status" : undefined}>
        {shown === "writing" && (
          <Spinner aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        )}
        <p className={TEXT_CLASS}>{copy.message}</p>
      </div>

      {copy.action && (
        <Button
          disabled={isPending || isCapped}
          onClick={isFailure ? retry : request}
          size="lg"
          variant={isFailure ? "outline" : "default"}
        >
          {isPending && <Spinner aria-hidden="true" data-icon="inline-start" role="presentation" />}
          {copy.action}
        </Button>
      )}

      {limit && <OutlineLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />}
    </div>
  );
}

/**
 * A topic of the plan whose lessons aren't written yet (the plan writes them two weeks ahead), as
 * a row (`trigger`, holding `children`) that opens a sheet: what the plan knows about it, and
 * "See the lessons", which writes its lesson plan now and shows its chapters once they're in. The
 * page is read again when the sheet closes after they landed: read while it's open, the plan could
 * take away the row the sheet opened from (its lessons are written now).
 */
export function FarTopicSheet({
  actions,
  chapterHref,
  children,
  lessons,
  nextDate,
  skillId,
  title,
  trigger,
}: {
  actions: TopicOutlineActions;
  chapterHref: (chapterId: string) => string;
  children: ReactNode;
  /** The lessons the plan teaches the topic; null when the plan doesn't know how many yet. */
  lessons: number | null;
  nextDate: string | null;
  skillId: string;
  title: string;
  /** The row the learner taps, rendered with `children` inside. */
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const landed = useRef(false);
  const line = useFarTopicLine();

  const changeOpen = (next: boolean) => {
    setOpen(next);

    if (!next && landed.current) {
      landed.current = false;
      actions.refresh();
    }
  };

  return (
    <Drawer onOpenChange={changeOpen} open={open}>
      <DrawerTrigger render={trigger}>{children}</DrawerTrigger>

      <DrawerPopup>
        <DrawerHeader className="flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <DrawerTitle className="text-xl font-semibold text-balance">{title}</DrawerTitle>
            <DrawerDescription>{line({ lessons, nextDate })}</DrawerDescription>
          </div>
          <DrawerCloseButton />
        </DrawerHeader>

        <DrawerContent className="pt-2">
          <FarTopicBody
            actions={actions}
            chapterHref={chapterHref}
            onLanded={() => {
              landed.current = true;
            }}
            open={open}
            skillId={skillId}
          />
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
