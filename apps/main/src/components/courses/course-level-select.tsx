"use client";

import { useRouter } from "@/i18n/navigation";
import { type CourseLevel } from "@zoonk/db";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@zoonk/ui/components/select";
import { useExtracted } from "next-intl";
import { useTransition } from "react";

export function CourseLevelSelect({
  brandSlug,
  courseSlug,
  levels,
  selected,
}: {
  brandSlug: string;
  courseSlug: string;
  levels: CourseLevel[];
  selected: CourseLevel | "all";
}) {
  const t = useExtracted();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const labels = {
    a1: t("A1 · Getting started"),
    a2: t("A2 · Everyday conversations"),
    advanced: t("Advanced"),
    b1: t("B1 · Independent conversations"),
    b2: t("B2 · Expressing complex ideas"),
    basic: t("Basic"),
    c1: t("C1 · Flexible, fluent expression"),
    c2: t("C2 · Nuanced communication"),
    intermediate: t("Intermediate"),
    overview: t("Overview"),
  };

  const items = [
    { label: t("All levels"), value: "all" },
    ...levels.map((level) => ({ label: labels[level], value: level })),
  ];

  return (
    <Select
      items={items}
      onValueChange={(value) => {
        if (value) {
          startTransition(() =>
            router.replace(
              `/b/${brandSlug}/c/${courseSlug}?edition=original&curriculum=full&level=${value}`,
            ),
          );
        }
      }}
      value={selected}
    >
      <SelectTrigger
        aria-busy={pending}
        aria-label={t("Course level")}
        className="min-h-11"
        disabled={pending}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
