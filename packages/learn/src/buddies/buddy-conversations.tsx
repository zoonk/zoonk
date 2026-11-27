"use client";

import { Button } from "@zoonk/ui/components/button";
import { Drawer, DrawerContent, DrawerPopup, DrawerTitle } from "@zoonk/ui/components/drawer";
import { RowPlus } from "@zoonk/ui/components/row-chevron";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { MessagesSquareIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import {
  ListGroup,
  ListRowBody,
  ListRowContent,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import {
  PAGE_SECTION_TITLE_CLASS,
  PageSection,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { SheetHeader } from "../_components/sheet-header";
import { useFormatMomentDate, useFormatMomentTime, useMomentDays } from "../_utils/iso-date";

export type BuddyConversation = { id: string; lastAskedAt: string; title: string };

export type BuddyConversationList = {
  conversationHref: (id: string) => string;
  conversations: readonly BuddyConversation[];
  /** Null once every conversation is listed. */
  more: { busy: boolean; failed: boolean; show: () => void } | null;
  newHref: string;
  /** Null while the open conversation has no question yet. */
  openId: string | null;
};

/** Today's rows say when, earlier ones which day. */
function useLastAsked() {
  const formatDate = useFormatMomentDate();
  const formatTime = useFormatMomentTime();
  const { dayOf, today } = useMomentDays();

  return (moment: string): string =>
    dayOf(moment) === today ? formatTime(moment) : formatDate(moment);
}

function ConversationRows({ list, onOpen }: { list: BuddyConversationList; onOpen?: () => void }) {
  const t = useExtracted();
  const lastAsked = useLastAsked();

  return (
    <>
      <ListGroup>
        <ListRowLink
          current={list.openId === null}
          end={<RowPlus />}
          href={list.newHref}
          onClick={onOpen}
        >
          <ListRowContent>
            <ListRowTitle>
              {t({
                description:
                  "The first row of the conversations list: starts a conversation with no questions yet.",
                message: "New conversation",
              })}
            </ListRowTitle>
          </ListRowContent>
        </ListRowLink>

        {list.conversations.map((conversation) => (
          <ListRowLink
            current={conversation.id === list.openId}
            href={list.conversationHref(conversation.id)}
            key={conversation.id}
            onClick={onOpen}
            prefetch="intent"
          >
            <ListRowBody>
              <ListRowContent>
                <ListRowTitle className="truncate text-nowrap">{conversation.title}</ListRowTitle>
              </ListRowContent>
              <ListRowTrailing>{lastAsked(conversation.lastAskedAt)}</ListRowTrailing>
            </ListRowBody>
          </ListRowLink>
        ))}
      </ListGroup>

      {list.more && (
        <div className="flex flex-col items-start gap-2">
          {list.more.failed && (
            <p className="text-muted-foreground text-sm" role="alert">
              {t("Couldn't load more conversations. Try again.")}
            </p>
          )}
          <Button busy={list.more.busy} onClick={list.more.show} size="sm" variant="outline">
            {t({
              description: "A button under a list that loads more of its rows.",
              message: "Show more",
            })}
          </Button>
        </div>
      )}
    </>
  );
}

/** `onOpen` runs as a row is pressed, before its conversation shows. */
export function BuddyConversations({
  list,
  onOpen,
}: {
  list: BuddyConversationList;
  onOpen?: () => void;
}) {
  const t = useExtracted();
  const titleId = useId();

  return (
    <PageSection aria-labelledby={titleId} data-slot="buddy-conversations">
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>
          {t({
            description:
              "The list of the learner's separate conversations with their buddy, and the button that opens it.",
            message: "Conversations",
          })}
        </PageSectionTitle>
      </PageSectionHeader>
      <ConversationRows list={list} onOpen={onOpen} />
    </PageSection>
  );
}

/**
 * The same list under 72rem, behind one button in the title row. The button keeps its room before
 * the goal has a conversation, so the first one's arrival moves nothing in the row.
 */
export function BuddyConversationsSheet({
  className,
  list,
}: {
  className?: string;
  list: BuddyConversationList;
}) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);

  if (list.conversations.length === 0) {
    return <span aria-hidden="true" className={cn("size-7.5 shrink-0", className)} />;
  }

  return (
    <>
      <Button
        aria-haspopup="dialog"
        className={className}
        onClick={() => setOpen(true)}
        size="icon-sm"
        variant="ghost"
      >
        <MessagesSquareIcon aria-hidden="true" />
        <span className="sr-only">{t("Conversations")}</span>
      </Button>

      <Drawer onOpenChange={setOpen} open={open}>
        <DrawerPopup>
          <SheetHeader>
            <DrawerTitle>{t("Conversations")}</DrawerTitle>
          </SheetHeader>

          <DrawerContent className="flex flex-col gap-3 pt-2">
            <ConversationRows list={list} onOpen={() => setOpen(false)} />
          </DrawerContent>
        </DrawerPopup>
      </Drawer>
    </>
  );
}

export function BuddyConversationsSkeleton() {
  const t = useExtracted();

  return (
    <PageSection>
      <PageSectionHeader>
        <span className={PAGE_SECTION_TITLE_CLASS}>{t("Conversations")}</span>
      </PageSectionHeader>
      <div className="flex flex-col">
        {["w-3/5", "w-4/5", "w-2/3"].map((width) => (
          <div className="min-h-control flex items-center justify-between gap-3" key={width}>
            <Skeleton className={`h-3.5 ${width}`} />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </PageSection>
  );
}
