"use client";

import { useExtracted } from "next-intl";
import { CategorizeGroupList } from "./categorize-group";
import { type Placements, misplacedItems } from "./categorize-placements";
import { CategorizeResults } from "./categorize-results";
import { CategorizeMoveRow, CategorizeResultRow } from "./categorize-row";

type Item = { groupId: string; id: string; text: string; why: string };
type Group = { id: string; label: string; rule: string };

export function CategorizeSorted({
  checkedPairs,
  groups,
  items,
  onMove,
  placements,
  rowId,
  statusRef,
}: {
  checkedPairs: Readonly<Record<string, string>> | null;
  groups: readonly Group[];
  items: readonly Item[];
  onMove: (itemId: string, groupId: string) => void;
  placements: Placements;
  rowId: (itemId: string) => string;
  statusRef: React.Ref<HTMLParagraphElement>;
}) {
  const t = useExtracted();

  const misplaced = checkedPairs
    ? misplacedItems({ expected: checkedPairs, items, placements })
    : [];

  return (
    <>
      <p className="text-sm font-medium tabular-nums outline-none" ref={statusRef} tabIndex={-1}>
        {checkedPairs
          ? t("{right} of {total} in the right group", {
              right: String(items.length - misplaced.length),
              total: String(items.length),
            })
          : t({
              description:
                "Shown once every card has a group. Choosing a card opens a menu that moves it to another group.",
              message: "All sorted. Choose a card to move it.",
            })}
      </p>

      <div className="flex flex-col gap-2.5">
        {groups.map((group) => {
          const cards = items.filter((item) => placements[item.id] === group.id);

          return (
            <CategorizeGroupList
              group={group}
              isChecked={checkedPairs !== null}
              isEmpty={cards.length === 0}
              key={group.id}
            >
              {cards.map((item) =>
                checkedPairs ? (
                  <CategorizeResultRow
                    isRight={checkedPairs[item.id] === group.id}
                    key={item.id}
                    text={item.text}
                  />
                ) : (
                  <CategorizeMoveRow
                    groupId={group.id}
                    id={rowId(item.id)}
                    itemId={item.id}
                    key={item.id}
                    onMove={(groupId) => onMove(item.id, groupId)}
                    otherGroups={groups.filter((other) => other.id !== group.id)}
                    text={item.text}
                  />
                ),
              )}
            </CategorizeGroupList>
          );
        })}
      </div>

      {checkedPairs && misplaced.length > 0 && (
        <CategorizeResults groups={groups} misplaced={misplaced} pairs={checkedPairs} />
      )}
    </>
  );
}
