import { type Finding } from "./checks.mts";
import { centerLeads, edgeLeads } from "./craft-edges.mts";
import {
  type Control,
  type CraftPage,
  type GapGroup,
  type Icon,
  type Ink,
  type TextStyle,
} from "./craft-probe.mts";
import {
  CONTROL_HEIGHTS,
  CRAFT_LINES,
  ICON_SIZES,
  ICON_STROKE,
  PAGE_TITLE_TOP,
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

export function titleLeads(titleTop: number | null): Finding[] {
  if (titleTop === null || Math.abs(titleTop - PAGE_TITLE_TOP) <= CRAFT_LINES.aligned) {
    return [];
  }

  return [
    lead(
      "E8",
      `the page's title starts ${px(titleTop)} under its frame's top, not ${px(PAGE_TITLE_TOP)}: padding over the title or the frame, or a hidden bar`,
      titleTop,
    ),
  ];
}

/** A panel shorter than this is a chip or a control's, whose padding is its own (Z1). */
const PANEL_MIN = 44;

/**
 * S4, as the founder ruled it (rule 11): what a panel holds has the same room on every side the
 * layout puts it against. Left and top always count, right only where something is pushed to the
 * end, bottom always; a panel whose content touches an edge (a picture across it) is left alone.
 */
export function roomLeads(ink: Ink[]): Finding[] {
  return ink.flatMap((box) => {
    if (
      box.kind !== "box" ||
      box.control ||
      box.inner === undefined ||
      box.bottom - box.top < PANEL_MIN
    ) {
      return [];
    }

    const held = ink.filter((item) => item.context === box.inner);
    const ends = held.filter((item) => item.rightCounts);

    if (held.length === 0) {
      return [];
    }

    const room = {
      bottom: box.bottom - Math.max(...held.map((item) => item.bottom)),
      left: Math.min(...held.map((item) => item.left)) - box.left,
      top: Math.min(...held.map((item) => item.top)) - box.top,
      ...(ends.length > 0
        ? { right: box.right - Math.max(...ends.map((item) => item.right)) }
        : {}),
    };

    const sides = Object.values(room);
    const spread = Math.max(...sides) - Math.min(...sides);

    if (Math.min(...sides) <= 0 || spread <= CRAFT_LINES.evenRoom) {
      return [];
    }

    return [
      lead(
        "S4",
        `${box.label} holds its content with ${Object.entries(room)
          .map(([side, value]) => `${px(value)} ${side}`)
          .join(", ")}: the same room on every side`,
        spread,
      ),
    ];
  });
}

/** One lead per message: a heatmap's every row with the same gap is one finding. */
export function craftFindings(page: CraftPage, typeScale: number[]): Finding[] {
  const findings = [
    ...edgeLeads(page.ink),
    ...roomLeads(page.ink),
    ...centerLeads(page.ink),
    ...shapeLeads(page),
    ...sizeLeads(page.controls),
    ...spacingLeads(page.gaps),
    ...typeLeads(page.texts, typeScale),
    ...iconLeads(page.icons),
    ...titleLeads(page.titleTop),
  ];

  return [
    ...new Map(
      findings.map((finding) => [`${finding.check} ${finding.message}`, finding]),
    ).values(),
  ];
}
