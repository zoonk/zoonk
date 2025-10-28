"use client";

import { Fallback, Image, Root } from "@radix-ui/react-avatar";
import { cn } from "@zoonk/ui/lib/utils";
import type * as React from "react";

function Avatar({ className, ...props }: React.ComponentProps<typeof Root>) {
  return (
    <Root
      className={cn(
        "relative flex size-9 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      data-slot="avatar"
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof Image>) {
  return (
    <Image
      className={cn("aspect-square size-full", className)}
      data-slot="avatar-image"
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof Fallback>) {
  return (
    <Fallback
      className={cn(
        "flex size-full items-center justify-center rounded-full bg-muted font-bold uppercase",
        className,
      )}
      data-slot="avatar-fallback"
      {...props}
    />
  );
}

function AvatarSkeleton() {
  return (
    <Avatar>
      <AvatarFallback />
    </Avatar>
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarSkeleton };
