"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon, CircleDashedIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../_components/lesson-rich-text";

/** Which key points a typed answer stated, so partial credit is visible point by point. */
export function LessonKeyPoints({ keyPoints }: { keyPoints: { met: boolean; text: string }[] }) {
  const t = useExtracted();
  const met = keyPoints.filter((point) => point.met).length;

  return (
    <div className="flex flex-col gap-2" data-slot="lesson-key-points">
      <p className="text-muted-foreground text-sm font-medium">
        {t("{met} of {total} key points", { met: String(met), total: String(keyPoints.length) })}
      </p>

      <ul className="flex flex-col gap-1.5">
        {keyPoints.map((point) => (
          <li className="flex items-start gap-2 text-sm" key={point.text}>
            {point.met ? (
              <CircleCheckIcon aria-hidden="true" className="text-success mt-0.5 size-4 shrink-0" />
            ) : (
              <CircleDashedIcon
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
              />
            )}
            <span className={cn(!point.met && "text-muted-foreground")}>
              <span className="sr-only">{point.met ? t("Stated:") : t("Missing:")} </span>
              <LessonRichText text={point.text} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
