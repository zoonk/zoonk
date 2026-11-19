"use client";

import { Link } from "@/i18n/navigation";
import { type ProfileQuestionsView } from "@zoonk/core/profile/questions/contract";
import { AboutYouScreen } from "@zoonk/learn/about-you";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useSelectedLayoutSegment } from "next/navigation";

/**
 * A picked question's place from 72rem, for whoever has a session: over the section's aside, as
 * wide as it, its Save at the foot level with the page's bar. Anywhere else it is the page.
 */
const PANE_CLASS = cn(
  "contents min-[72rem]:in-data-signed-in:fixed min-[72rem]:in-data-signed-in:inset-y-0 min-[72rem]:in-data-signed-in:right-0 min-[72rem]:in-data-signed-in:z-40",
  "min-[72rem]:in-data-signed-in:flex min-[72rem]:in-data-signed-in:w-[299px] min-[72rem]:in-data-signed-in:flex-col min-[72rem]:in-data-signed-in:overflow-y-auto xl:in-data-signed-in:w-[calc(20rem-1px)]",
  "min-[72rem]:in-data-signed-in:bg-background min-[72rem]:in-data-signed-in:px-frame min-[72rem]:in-data-signed-in:pt-3 min-[72rem]:in-data-signed-in:[--page-bottom:0px] min-[72rem]:in-data-signed-in:[--page-dock:0px]",
);

/** The list gives the page to a picked question, except where that question opens beside it. */
const LIST_CLASS = "hidden min-[72rem]:in-data-signed-in:contents";

const CLOSE_CLASS = "hidden min-[72rem]:in-data-signed-in:inline-flex";

export function AboutYouSplit({
  children,
  list,
}: {
  children: React.ReactNode;
  list: React.ReactNode;
}) {
  const t = useExtracted();
  const picked = useSelectedLayoutSegment() !== null;

  return (
    <>
      <div className={picked ? LIST_CLASS : "contents"}>{list}</div>

      <div className={picked ? PANE_CLASS : "contents"} data-slot="settings-detail">
        {picked && (
          <Link
            className={cn(
              buttonVariants({ size: "icon-bar", variant: "ghost" }),
              "edge -mb-2 self-end",
              CLOSE_CLASS,
            )}
            href="/settings/about-you"
          >
            <XIcon aria-hidden="true" />
            <span className="sr-only">{t("Close")}</span>
          </Link>
        )}
        {children}
      </div>
    </>
  );
}

/** The list, with the question open beside it marked as the current one. */
export function AboutYouCurrentScreen({ view }: { view: ProfileQuestionsView }) {
  return <AboutYouScreen current={useSelectedLayoutSegment()} view={view} />;
}
