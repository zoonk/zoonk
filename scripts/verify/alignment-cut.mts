import { type AlignmentFinding } from "./alignment-capture.mts";
import { type Context, EDGE, finding, tenths } from "./alignment-geometry.mts";

/**
 * Nothing is cut that isn't in a scroller: a box clipping what it holds, outside `HorizontalScroll`
 * (which fades where it continues) and a declared clamp (an ellipsis, a line clamp), hides part of
 * a text or a control with no sign it's there. The probe records only what draws past the box.
 */
export function cutLeads(context: Context): AlignmentFinding[] {
  return context.capture.elements
    .filter((element) => element.part === "cut" && Math.max(...(element.overflow ?? [0, 0])) > EDGE)
    .map((cut) => {
      const [across = 0, down = 0] = cut.overflow ?? [];

      const by = [
        ...(across > 0 ? [`${tenths(across)} past it across`] : []),
        ...(down > 0 ? [`${tenths(down)} past it down`] : []),
      ];

      return finding(context, {
        detail: cut.reason
          ? `${cut.text ?? cut.name ?? cut.id}: content continues ${tenths(across)} across with no kit scroll sign`
          : `${cut.text ?? "what it holds"} is cut by ${cut.name ?? cut.id}: ${by.join(", ")}`,
        level: "fail",
        measured: Math.max(across, down),
        message: cut.reason
          ? "a horizontal scroller has no kit scroll sign"
          : "a box cuts what it holds with no sign it scrolls",
        piece: "page",
        rule: "cut",
      });
    });
}
