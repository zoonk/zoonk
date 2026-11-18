"use client";

import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityReason, ActivityReasons } from "../_components/activity-reasons";

type Item = { groupId: string; id: string; text: string; why: string };
type Group = { id: string; label: string };

function MisplacedItem({ group, item }: { group: string; item: string }) {
  const t = useExtracted();
  const groupText = () => <LessonRichText text={group} />;
  const itemText = () => <LessonRichText text={item} />;

  return t.rich("<item></item> belongs in <group></group>.", { group: groupText, item: itemText });
}

export function CategorizeResults({
  groups,
  misplaced,
  pairs,
}: {
  groups: readonly Group[];
  misplaced: readonly Item[];
  pairs: Readonly<Record<string, string>>;
}) {
  const groupLabel = (groupId: string | undefined) =>
    groups.find((group) => group.id === groupId)?.label ?? "";

  return (
    <ActivityReasons>
      {misplaced.map((item) => (
        <ActivityReason key={item.id} why={item.why}>
          <MisplacedItem group={groupLabel(pairs[item.id])} item={item.text} />
        </ActivityReason>
      ))}
    </ActivityReasons>
  );
}
