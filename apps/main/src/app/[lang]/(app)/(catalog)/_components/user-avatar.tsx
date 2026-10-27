"use client";

import { useFrameLearner } from "@/components/learner/learner-seed-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@zoonk/ui/components/avatar";
import { cn } from "@zoonk/ui/lib/utils";
import { User } from "lucide-react";

/**
 * The learner's photo or initial. A guest has no name of their own yet (auth calls them
 * "Anonymous"), so they get the plain person icon: their `name` is left out.
 */
export function UserAvatar({ image, name }: { image?: string | null; name?: string | null }) {
  const fallback = name?.[0] || <User size={16} />;

  return (
    <Avatar className="focus-visible:ring-ring size-full cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2">
      <AvatarImage src={image || undefined} />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}

/**
 * A learner's account place while their summary is unread, only on a page the session hint marked
 * signed in (`signed-in:`): the plain person avatar at the account's size (`className`), filled in
 * once the summary arrives. A visitor's look stands there otherwise (`VisitorLook`).
 */
export function PendingAccountAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("signed-in:flex hidden shrink-0 overflow-hidden rounded-full", className)}
    >
      <UserAvatar />
    </span>
  );
}

/**
 * The signed-in learner's (or guest's) avatar, from the learner summary: drawn where the learner is
 * already read, so it never waits.
 */
export function LearnerAvatar() {
  const learner = useFrameLearner();

  if (learner.status !== "ready") {
    return <UserAvatar />;
  }

  const { account, identity } = learner.summary;

  return (
    <UserAvatar
      image={account.image}
      name={identity.isAnonymous ? null : account.name || account.email}
    />
  );
}
