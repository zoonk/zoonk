import { type AlignmentFinding } from "./alignment-capture.mts";
import { type Context, EDGE, box, finding, tenths } from "./alignment-geometry.mts";

/**
 * At the scroll's end nothing rests under a pinned bar: the page keeps room for it, so its last
 * row ends above the bar's top (#12's Save bar over a condition's caption). The probe records a
 * pinned bar only when the page is at its scroll's end, where this can be judged.
 */
export function pinnedLeads(context: Context): AlignmentFinding[] {
  const { elements } = context.capture;
  const bars = elements.filter((element) => element.part === "pinned");
  const rows = elements.filter((element) => element.part === "row");

  return bars.flatMap((bar) => {
    const pinned = box(bar.bounds);

    // What the bar holds rides with it: a group the capture names as drawn in it, or one drawn as
    // the bar itself (its button row), where a platform names none.
    const own = new Set(
      elements
        .filter(
          (group) =>
            group.part === "group" &&
            (group.pinnedIn === bar.id ||
              group.bounds.every(
                (value, index) => Math.abs(value - (bar.bounds[index] ?? 0)) <= EDGE,
              )),
        )
        .map((group) => group.id),
    );

    return rows.flatMap((row) => {
      if (row.group !== null && own.has(row.group)) {
        return [];
      }

      const drawn = box(row.bounds);
      const covered = drawn.bottom - pinned.top;

      if (
        covered <= EDGE ||
        drawn.top >= pinned.bottom ||
        drawn.right <= pinned.left ||
        drawn.left >= pinned.right
      ) {
        return [];
      }

      return [
        finding(context, {
          detail: `${bar.name ?? "the pinned bar"} covers ${tenths(covered)} of ${row.name ?? `row ${row.id}`}`,
          level: "fail",
          measured: covered,
          message: "a row rests under a pinned bar at the scroll's end",
          piece: "page",
          rule: "pinned",
        }),
      ];
    });
  });
}
