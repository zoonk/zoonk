"use client";

import { BookmarkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";

export function SavedLessonsRow({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <ListRowLink href={href}>
      <ListRowLeading>
        <ListRowIcon>
          <BookmarkIcon />
        </ListRowIcon>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{t("Saved lessons")}</ListRowTitle>
        <ListRowDescription>
          {t({
            description: "The line under Saved lessons in Practice anytime.",
            message: "Lessons you want to do again",
          })}
        </ListRowDescription>
      </ListRowContent>
    </ListRowLink>
  );
}
