"use client";

import { Message, MessageContent } from "@zoonk/ui/components/message";
import { useExtracted } from "next-intl";
import { BuddyArt } from "../buddies/buddy-art";
import { type LearnBuddy, resolveLearnBuddy, useBuddyName } from "../buddies/use-buddy-name";

export type { LearnBuddy } from "../buddies/use-buddy-name";

/** `avatar` marks the buddy's words; `figure` is the whole buddy, for a place it has to itself. */
export type TutorIdentity = { avatar: React.ReactNode; figure: React.ReactNode; name: string };

export function useTutorIdentity(buddy: LearnBuddy | null | undefined): TutorIdentity {
  const t = useExtracted();
  const resolved = resolveLearnBuddy(buddy ?? null);
  const name = useBuddyName(resolved);

  return buddy === undefined
    ? { avatar: null, figure: null, name: t("Your buddy") }
    : {
        avatar: <BuddyArt buddy={resolved} className="size-8" view="face" />,
        figure: <BuddyArt buddy={resolved} className="[--buddy-height:--spacing(24)]" fit="ink" />,
        name,
      };
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
      <Message className="text-reading leading-[1.55]">
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
