"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@zoonk/ui/components/empty";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

function handleRetry() {
  globalThis.location.reload();
}

export function ErrorView({
  title,
  description,
  retryLabel,
  supportLabel,
  supportHref,
}: {
  title: string;
  description: string;
  retryLabel: string;
  supportLabel: string;
  supportHref: string;
}) {
  return (
    <Empty className="border-none py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircleIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <div className="flex items-center gap-3">
          <Button onClick={handleRetry} size="sm">
            <RefreshCwIcon aria-hidden="true" className="size-4" />
            {retryLabel}
          </Button>

          {/* oxlint-disable-next-line next/no-html-link-for-pages -- external link */}
          <a className={buttonVariants({ size: "sm", variant: "outline" })} href={supportHref}>
            {supportLabel}
          </a>
        </div>
      </EmptyContent>
    </Empty>
  );
}
