"use client";

import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityReason, ActivityReasons } from "../_components/activity-reasons";
import { type Placements, misplacedItems } from "./categorize-placements";

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
  items,
  pairs,
  placements,
}: {
  groups: readonly Group[];
  items: readonly Item[];
  pairs: Readonly<Record<string, string>>;
  placements: Placements;
}) {
  const t = useExtracted();
  const misplaced = misplacedItems({ expected: pairs, items, placements });

  const groupLabel = (groupId: string | undefined) =>
    groups.find((group) => group.id === groupId)?.label ?? "";

  return (
    <div className="flex flex-col gap-2" data-slot="categorize-results">
      <p className="text-sm font-semibold tabular-nums">
        {t("{right} of {total} in the right group", {
          right: String(items.length - misplaced.length),
          total: String(items.length),
        })}
      </p>

      {misplaced.length > 0 && (
        <ActivityReasons>
          {misplaced.map((item) => (
            <ActivityReason key={item.id} why={item.why}>
              <MisplacedItem group={groupLabel(pairs[item.id])} item={item.text} />
            </ActivityReason>
          ))}
        </ActivityReasons>
      )}
    </div>
  );
}
