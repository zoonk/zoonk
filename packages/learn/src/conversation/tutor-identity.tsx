"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { Message, MessageContent } from "@zoonk/ui/components/message";
import { type LearnBuddy, resolveLearnBuddy, useBuddyName } from "../buddies/use-buddy-name";

export type { LearnBuddy } from "../buddies/use-buddy-name";

/** Who answers in a conversation: the learner's buddy, by its face and name. */
export type TutorIdentity = { avatar: React.ReactNode; name: string };

function TutorAvatar({ buddy }: { buddy: LearnBuddy }) {
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
 * sheet in a lesson, a chapter or a mock): its face and name, including the default buddy.
 *
 * ```tsx
 * const identity = useTutorIdentity(buddy);
 * ```
 */
export function useTutorIdentity(buddy: LearnBuddy | null): TutorIdentity {
  const resolved = resolveLearnBuddy(buddy);
  return { avatar: <TutorAvatar buddy={resolved} />, name: useBuddyName(resolved) };
}

/**
 * A message from the learner's buddy, with its name for screen readers. On its own page (the buddy
 * tab, `page`) its words are plain text on the page, as in the buddy's chat: its face is in the
 * page's header, and only the learner's words sit in a bubble. In a sheet it stays compact, its
 * face beside what it says.
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
  if (page) {
    return (
      <Message className="text-[0.9375rem] leading-[1.55]">
        <MessageContent>
          <span className="sr-only">{identity.name}</span>
          {children}
        </MessageContent>
      </Message>
    );
  }

  return (
    <Message className="gap-3">
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
