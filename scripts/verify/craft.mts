import { type Finding } from "./checks.mts";
import { centerLeads, edgeLeads } from "./craft-edges.mts";
import {
  type Control,
  type CraftPage,
  type GapGroup,
  type Icon,
  type TextStyle,
} from "./craft-probe.mts";
import {
  CONTROL_HEIGHTS,
  CRAFT_LINES,
  ICON_SIZES,
  ICON_STROKE,
  RADIUS_STEPS,
  SAME_WITHIN,
  SMALL_RADII,
  SPACING,
  THICKENED_MAX,
  grouped,
  lead,
  names,
  onScale,
  px,
} from "./craft-rules.mts";

const PILL_RATIO = 1.2;

export function shapeLeads({
  controls,
  radius,
}: Pick<CraftPage, "controls" | "radius">): Finding[] {
  const system = [...SMALL_RADII, ...RADIUS_STEPS.map((step) => radius + step)];

  const off = grouped(
    controls.filter((control) => control.radius !== -1 && !onScale(control.radius, system)),
    (control) => control.radius,
  ).map(([value, here]) =>
    lead(
      "H1",
      `${names(here.map((control) => control.label))}: a ${px(value)} corner, not one of the system's (${system.map((allowed) => Math.round(allowed)).join(", ")} px)`,
      value,
    ),
  );

  const pills = controls.filter(
    (control) => control.radius === -1 && control.width > control.height * PILL_RATIO,
  );

  const rounded = controls.some((control) => control.kind !== "panel" && control.radius > 0);
  const square = controls.filter((control) => control.kind !== "panel" && control.radius === 0);

  return [
    ...off,
    ...(pills.length > 0
      ? [
          lead(
            "H3",
            `${names(pills.map((control) => control.label))}: a pill, where only avatars, dots and rings are round`,
          ),
        ]
      : []),
    ...(rounded && square.length > 0
      ? [
          lead(
            "H3",
            `${names(square.map((control) => control.label))}: square corners beside rounded controls`,
          ),
        ]
      : []),
  ];
}

function sideBySide(one: Control, other: Control) {
  const GAP = 16;

  return (
    Math.min(one.bottom, other.bottom) - Math.max(one.top, other.top) > 0 &&
    Math.max(one.left, other.left) - Math.min(one.right, other.right) <= GAP
  );
}

export function sizeLeads(controls: Control[]): Finding[] {
  const sized = controls.filter((control) => control.kind !== "panel");

  const off = grouped(
    sized.filter((control) => !onScale(control.height, CONTROL_HEIGHTS)),
    (control) => control.height,
  ).map(([height, here]) =>
    lead(
      "Z1",
      `${names(here.map((control) => control.label))}: ${px(height)} tall, not one of the system's heights (${CONTROL_HEIGHTS.join(", ")} px)`,
      height,
    ),
  );

  const uneven = sized.flatMap((control, index) =>
    sized
      .slice(index + 1)
      .filter(
        (other) =>
          sideBySide(control, other) && Math.abs(other.height - control.height) > SAME_WITHIN,
      )
      .map((other) =>
        lead(
          "Z1",
          `${control.label} (${px(control.height)}) and ${other.label} (${px(other.height)}) share a row at two heights`,
          Math.abs(other.height - control.height),
        ),
      ),
  );

  return [...off, ...uneven];
}

export function spacingLeads(gaps: GapGroup[]): Finding[] {
  return gaps.flatMap((group) => {
    const spaced = group.gaps.filter((gap) => gap >= CRAFT_LINES.packed);

    if (group.distributed || spaced.length === 0) {
      return [];
    }

    const low = Math.min(...group.gaps);
    const high = Math.max(...group.gaps);
    const offScale = spaced.find((gap) => !onScale(gap, SPACING));

    return [
      ...(high - low > 1
        ? [
            lead(
              "S2",
              `the items of ${group.label} are ${group.gaps.map((gap) => px(gap)).join(", ")} apart: one kind of item, one gap`,
              high - low,
            ),
          ]
        : []),
      ...(offScale === undefined
        ? []
        : [
            lead(
              "S1",
              `the items of ${group.label} are ${px(offScale)} apart, not a step of the spacing scale (${SPACING.join(", ")} px)`,
              offScale,
            ),
          ]),
    ];
  });
}

/** `scale` is the checkout's type sizes (`readTypeScale`): its roles' and its shared pieces'. */
export function typeLeads(texts: TextStyle[], scale: number[]): Finding[] {
  const off = grouped(
    texts.filter((text) => !onScale(text.size, scale)),
    (text) => text.size,
  ).map(([size, here]) =>
    lead(
      "T1",
      `${names(here.map((text) => text.label))}: ${px(size)} text, not a size of a type role or a shared piece`,
      size,
    ),
  );

  const crowded = grouped(
    texts.filter((text) => text.block !== -1 && !text.inline),
    (text) => text.block,
  ).flatMap(([, here]) => {
    const sizes = grouped(here, (text) => text.size).toSorted(([one], [other]) => other - one);

    return sizes.length > CRAFT_LINES.typeSizes
      ? [
          lead(
            "T1",
            `${sizes.length} type sizes in one block: ${sizes.map(([size, sized]) => `${px(size)} (${sized[0]?.label ?? ""})`).join(", ")}`,
          ),
        ]
      : [];
  });

  return [...off, ...crowded];
}

export function iconLeads(icons: Icon[]): Finding[] {
  const off = grouped(
    icons.filter((icon) => !onScale(icon.size, ICON_SIZES)),
    (icon) => icon.size,
  ).map(([size, here]) =>
    lead(
      "I2",
      `${names(here.map((icon) => icon.label))}: ${px(size)}, not one of the icon sizes (${ICON_SIZES.join(", ")} px)`,
      size,
    ),
  );

  const restroked = grouped(
    icons.filter(
      (icon) => icon.stroke !== null && icon.stroke !== ICON_STROKE && icon.size > THICKENED_MAX,
    ),
    (icon) => icon.stroke,
  ).map(([stroke, here]) =>
    lead(
      "I3",
      `${names(here.map((icon) => icon.label))}: drawn with a ${stroke} stroke where Lucide draws ${ICON_STROKE}, so it's heavier or lighter than the icons around it`,
    ),
  );

  return [...off, ...restroked];
}

/** One lead per message: a heatmap's every row with the same gap is one finding. */
export function craftFindings(page: CraftPage, typeScale: number[]): Finding[] {
  const findings = [
    ...edgeLeads(page.ink),
    ...centerLeads(page.ink),
    ...shapeLeads(page),
    ...sizeLeads(page.controls),
    ...spacingLeads(page.gaps),
    ...typeLeads(page.texts, typeScale),
    ...iconLeads(page.icons),
  ];

  return [
    ...new Map(
      findings.map((finding) => [`${finding.check} ${finding.message}`, finding]),
    ).values(),
  ];
}

/** How many of each a screen uses, for the loads table: fewer reads calmer. */
export type CraftCounts = { heights: number; icons: number; radii: number; sizes: number };

export function countCraft(page: CraftPage): CraftCounts {
  const controls = page.controls.filter((control) => control.kind !== "panel");

  return {
    heights: new Set(controls.map((control) => Math.round(control.height))).size,
    icons: new Set(page.icons.map((icon) => Math.round(icon.size))).size,
    radii: new Set(controls.map((control) => control.radius)).size,
    sizes: new Set(page.texts.map((text) => text.size)).size,
  };
}
