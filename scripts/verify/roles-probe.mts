type RoleBox = { x: number; y: number; width: number; height: number };
export type RoleSample = {
  role: string;
  index: number;
  box: RoleBox;
  gap: number | null;
  glyph: string | null;
  label: string;
  /** The face, size, weight and color its first drawn words are set in; null when it draws none. */
  type: string | null;
};

/** Runs in the measured page; the slots belong to the shared pieces, not to a screen's classes. */
export function readRoles({
  listGroup,
  overlays,
}: {
  listGroup: { group: string; rows: string };
  overlays: { panel: string }[];
}): RoleSample[] {
  const tailRows = 3;

  const selectors = {
    "back-link": '[data-slot="back-link"]',
    "bottom-bar": '[data-slot="bottom-bar"]',
    empty: '[data-slot="empty"]',
    eyebrow: '[data-slot="eyebrow"]',
    "list-tail": listGroup.group,
    overlay: overlays.map(({ panel }) => `[data-slot=${panel}]`).join(", "),
    "page-top": '[data-slot="page-top"], [data-slot="page-header"]',
    "subscription-gate": '[data-slot="subscribe-gate"]',
    tabs: '[data-slot="tabs-list"], [data-tabs]',
  };

  const { shown } = globalThis.zoonkPage;

  return Object.entries(selectors).flatMap(([role, selector]) =>
    [...document.querySelectorAll<HTMLElement>(selector)]
      .filter(
        (node) =>
          shown(node) &&
          !(
            role === "page-top" &&
            node.matches("[data-slot=page-top]") &&
            node.querySelector("[data-slot=page-header]")
          ),
      )
      .flatMap((node, index) => {
        const rows =
          role === "list-tail"
            ? [...node.querySelectorAll(listGroup.rows)]
                .filter((row) => shown(row))
                .slice(-tailRows)
            : [];

        const boxes =
          rows.length > 0
            ? rows.map((row) => row.getBoundingClientRect())
            : [node.getBoundingClientRect()];

        const left = Math.max(0, Math.min(...boxes.map((box) => box.left)));
        const top = Math.max(0, Math.min(...boxes.map((box) => box.top)));
        const right = Math.min(innerWidth, Math.max(...boxes.map((box) => box.right)));
        const bottom = Math.min(innerHeight, Math.max(...boxes.map((box) => box.bottom)));

        if (right <= left || bottom <= top) {
          return [];
        }

        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        let words: Element | null = null;

        for (let text = walker.nextNode(); text && !words; text = walker.nextNode()) {
          words =
            text.textContent?.trim() && text.parentElement && shown(text.parentElement)
              ? text.parentElement
              : null;
        }

        const set = words ? getComputedStyle(words) : null;
        const icon = node.querySelector("svg");
        const glyph = icon?.getBoundingClientRect();
        const gap = Number(getComputedStyle(node).columnGap.replace(/px$/u, ""));

        return [
          {
            box: { height: bottom - top, width: right - left, x: left, y: top },
            gap: Number.isFinite(gap) ? Math.round(gap * 10) / 10 : null,
            glyph: glyph
              ? `${Math.round(glyph.width * 10) / 10}×${Math.round(glyph.height * 10) / 10}`
              : null,
            index,
            label: (rows.length > 0
              ? rows.map((row) => row.textContent ?? "").join(" ")
              : (node.getAttribute("aria-label") ?? node.textContent ?? "")
            )
              .replaceAll(/\s+/gu, " ")
              .trim(),
            role,
            type: set
              ? `${set.fontFamily.split(",")[0]?.replaceAll(/["']/gu, "").trim()} ${set.fontSize} ${set.fontWeight} ${set.color}`
              : null,
          },
        ];
      }),
  );
}
