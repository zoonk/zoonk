"use client";

import { HistoryIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  ListRowContent,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";

export function CompletedLessonsRow({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <ListRowLink href={href}>
      <ListRowLeading>
        <ListRowIcon>
          <HistoryIcon />
        </ListRowIcon>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{t("Completed lessons")}</ListRowTitle>
      </ListRowContent>
    </ListRowLink>
  );
}
