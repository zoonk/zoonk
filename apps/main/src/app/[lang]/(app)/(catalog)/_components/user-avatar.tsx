"use client";

import { useFrameLearner } from "@/components/learner/learner-seed-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@zoonk/ui/components/avatar";
import { cn } from "@zoonk/ui/lib/utils";
import { User } from "lucide-react";

/** A guest has no name of their own (auth calls them "Anonymous"), so they get the plain person icon. */
export function UserAvatar({ image, name }: { image?: string | null; name?: string | null }) {
  const fallback = name?.[0] || <User size={16} />;

  return (
    <Avatar className="focus-visible:ring-ring size-full cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2">
      <AvatarImage src={image || undefined} />
      <AvatarFallback>{fallback}</AvatarFallback>
    </Avatar>
  );
}

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
