"use client";

import { ArrowUpRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type UnderstoodRow as Row } from "./use-understood-rows";

const MAX_SOURCE_TITLE_LENGTH = 40;

function getSourceName(source: NonNullable<Row["source"]>): string {
  const host = URL.canParse(source.url)
    ? new URL(source.url).hostname.replace(/^www\./u, "")
    : null;

  const title = source.title?.trim();
  return title && title.length <= MAX_SOURCE_TITLE_LENGTH ? title : (host ?? source.url);
}

export function SourceLink({ source }: { source: NonNullable<Row["source"]> }) {
  const t = useExtracted();

  return (
    <a
      className="hover:text-foreground focus-visible:ring-ring/50 inline-flex max-w-full items-center gap-0.5 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]"
      href={source.url}
      rel="noreferrer"
      target="_blank"
      title={source.title ?? undefined}
    >
      <span className="truncate">{t("Source: {source}", { source: getSourceName(source) })}</span>
      <ArrowUpRightIcon aria-hidden="true" className="size-3 shrink-0" />
    </a>
  );
}
