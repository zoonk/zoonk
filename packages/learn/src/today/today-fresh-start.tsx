"use client";

import { SunriseIcon } from "lucide-react";
import { KindTile } from "../_components/kind-tile";
import {
  NoticeCard,
  NoticeCardContent,
  NoticeCardLeading,
  NoticeCardTitle,
} from "../_components/notice-card";
import { useFreshStartText } from "./use-today-copy";

export function TodayFreshStart() {
  const text = useFreshStartText();

  if (!text) {
    return null;
  }

  return (
    <NoticeCard>
      <NoticeCardLeading>
        <KindTile icon={SunriseIcon} kind="review" size="sm" />
      </NoticeCardLeading>
      <NoticeCardContent className="min-h-8 justify-center">
        <NoticeCardTitle className="font-medium">{text}</NoticeCardTitle>
      </NoticeCardContent>
    </NoticeCard>
  );
}
