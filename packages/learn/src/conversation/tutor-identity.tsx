"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { Message, MessageContent } from "@zoonk/ui/components/message";
import { useExtracted } from "next-intl";
import { type LearnBuddy, resolveLearnBuddy, useBuddyName } from "../buddies/use-buddy-name";

export type { LearnBuddy } from "../buddies/use-buddy-name";

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

export function useTutorIdentity(buddy: LearnBuddy | null | undefined): TutorIdentity {
  const t = useExtracted();
  const resolved = resolveLearnBuddy(buddy ?? null);
  const name = useBuddyName(resolved);

  return buddy === undefined
    ? { avatar: null, name: t("Your buddy") }
    : { avatar: <TutorAvatar buddy={resolved} />, name };
}

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
