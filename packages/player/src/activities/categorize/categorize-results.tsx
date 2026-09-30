"use client";

import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { type Placements, misplacedItems } from "./categorize-placements";

type Item = { groupId: string; id: string; text: string; why: string };
type Group = { id: string; label: string };

/**
 * After the check: how many items landed in the right group, and for each one that didn't,
 * where it belongs and why. Groups come from code, the reasons from the writer's `why`.
 */
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
        <ul className="flex flex-col gap-2">
          {misplaced.map((item) => (
            <li
              className="bg-background rounded-2xl border px-3 py-2.5 text-sm leading-snug"
              key={item.id}
            >
              <p>
                {t("{item} belongs in {group}.", {
                  group: groupLabel(pairs[item.id]),
                  item: item.text,
                })}
              </p>

              <p className="text-muted-foreground mt-0.5">
                <LessonRichText text={item.why} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
