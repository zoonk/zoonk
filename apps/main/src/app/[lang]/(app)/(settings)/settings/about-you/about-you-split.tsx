"use client";

import { Link } from "@/i18n/navigation";
import { type ProfileQuestionsView } from "@zoonk/core/profile/questions/contract";
import { AboutYouScreen } from "@zoonk/learn/about-you";
import { SIDE_DETAIL_PLACE_CLASS } from "@zoonk/learn/side-detail";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useSelectedLayoutSegment } from "next/navigation";

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

      <div className={picked ? SIDE_DETAIL_PLACE_CLASS : "contents"} data-slot="settings-detail">
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
