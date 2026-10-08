"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { Message, MessageContent } from "@zoonk/ui/components/message";
import { cn } from "@zoonk/ui/lib/utils";
import { SmileIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";

export type { LearnBuddy } from "../buddies/use-buddy-name";

/** Who answers in a conversation: the learner's buddy, by its face and name. */
export type TutorIdentity = { avatar: React.ReactNode; name: string };

/** Before a buddy is picked, the tutor is simply "Buddy", as its tab says. */
function useTutorName(buddy: LearnBuddy | null): string {
  const t = useExtracted();
  const buddyName = useBuddyName(buddy ?? { kind: "zu", name: null });
  return buddy ? buddyName : t("Buddy");
}

function TutorAvatar({ buddy }: { buddy: LearnBuddy | null }) {
  if (!buddy) {
    return (
      <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-full">
        <SmileIcon className="size-4" />
      </span>
    );
  }

  return (
    <Buddy
      beltColor={buddy.beltColor}
      className="size-8"
      crop="face"
      energy={buddy.energy}
      glasses={buddy.glasses}
      kind={buddy.kind}
      studiedToday={buddy.studiedToday}
    />
  );
}

/**
 * The learner's buddy as the one who answers in every conversation (the buddy tab, the questions
 * sheet in a lesson, a chapter or a mock): its face and name, or a neutral "Buddy" before the
 * learner picks one.
 *
 * ```tsx
 * const identity = useTutorIdentity(buddy);
 * ```
 */
export function useTutorIdentity(buddy: LearnBuddy | null): TutorIdentity {
  return { avatar: <TutorAvatar buddy={buddy} />, name: useTutorName(buddy) };
}

/**
 * A message from the learner's buddy: its face beside what it says, as in a chat, with its name
 * for screen readers. On a page it reads at body size; in a sheet it stays compact.
 */
export function TutorMessage({
  children,
  identity,
  page = false,
}: {
  children: React.ReactNode;
  identity: TutorIdentity;
  page?: boolean;
}) {
  return (
    <Message className={cn("gap-3", page && "text-base")}>
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center">
        {identity.avatar}
      </span>
      <MessageContent className="pt-1">
        <span className="sr-only">{identity.name}</span>
        {children}
      </MessageContent>
    </Message>
  );
}
