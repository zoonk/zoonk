import "server-only";
import { getExtracted } from "next-intl/server";
import { formatCount } from "./certificate-format";
import {
  type SheetCovered,
  type SheetGraphKind,
  getCoveredFallbacks,
  getLinkOverflow,
  getPostOverflow,
  getSheetOverflow,
} from "./certificate-layout";
import { CERTIFICATE_COLORS } from "./certificate-palette";
import { SHARE, SHEET, TEXT, type TextSpec } from "./certificate-spec";
import { type CertificateView } from "./certificate-view";
import {
  type ShapedText,
  type TextBox,
  type TextRun,
  shapeClampedText,
  shapeText,
} from "./shaped-text";

type Shaping = { locale: string; scale: number; view: CertificateView };

/** Sizes from `largest` down to `smallest` in the design's steps, in pixels. */
function getSizes({
  largest,
  scale,
  smallest,
}: {
  largest: number;
  scale: number;
  smallest: number;
}): number[] {
  return Array.from(
    { length: Math.floor((largest - smallest) / TEXT.sizeStep) + 1 },
    (_value, index) => (largest - index * TEXT.sizeStep) * scale,
  );
}

/** Han characters take Japanese, Korean or Chinese shapes from the text's language. */
function getTextLang({ locale, text }: { locale: string; text: string }): string {
  if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)) {
    return "ja";
  }

  if (/\p{Script=Hangul}/u.test(text)) {
    return "ko";
  }

  if (locale !== "ja" && locale !== "ko" && /\p{Script=Han}/u.test(text)) {
    return "zh-cn";
  }

  return locale;
}

function getBox({
  runs,
  shaping,
  spec,
  weight = spec.weight,
}: {
  runs: readonly TextRun[];
  shaping: Shaping;
  spec: TextSpec;
  weight?: number;
}): TextBox {
  return {
    lang: getTextLang({ locale: shaping.locale, text: runs.map((run) => run.text).join("") }),
    letterSpacing: spec.letterSpacing,
    lineHeight: spec.lineHeight,
    maxLines: spec.lines,
    weight,
    width: spec.width * shaping.scale,
  };
}

function getName(shaping: Shaping, spec: TextSpec) {
  const { name } = shaping.view;

  const runs = [
    {
      color: name.isPlaceholder ? CERTIFICATE_COLORS.faint : CERTIFICATE_COLORS.ink,
      text: name.text,
    },
  ];

  const weight = name.isPlaceholder ? TEXT.placeholderWeight : spec.weight;

  return { box: getBox({ runs, shaping, spec, weight }), runs };
}

function getTitle(shaping: Shaping, spec: TextSpec) {
  const runs = shaping.view.title;
  return { box: getBox({ runs, shaping, spec }), runs };
}

function shapeSpec({
  box,
  runs,
  scale,
  spec,
}: {
  box: TextBox;
  runs: readonly TextRun[];
  scale: number;
  spec: TextSpec;
}): Promise<ShapedText> {
  return shapeText({
    box,
    runs,
    sizes: getSizes({ largest: spec.largest, scale, smallest: spec.smallest }),
  });
}

/** Steps text below its smallest size, past its line cap, until the picture's parts fit. */
function shrinkUntil({
  box,
  fits,
  runs,
  scale,
  shaped,
}: {
  box: TextBox;
  fits: (shaped: ShapedText) => boolean;
  runs: readonly TextRun[];
  scale: number;
  shaped: ShapedText;
}): Promise<ShapedText> {
  const current = shaped.size / scale;

  if (fits(shaped) || current - TEXT.sizeStep < TEXT.smallestSize) {
    return Promise.resolve(shaped);
  }

  return shapeText({
    box: { ...box, maxLines: Number.POSITIVE_INFINITY },
    fits,
    runs,
    sizes: getSizes({ largest: current - TEXT.sizeStep, scale, smallest: TEXT.smallestSize }),
  });
}

function toSheetCovered(view: CertificateView): SheetCovered {
  if (!view.covered) {
    return null;
  }

  return view.covered.kind === "topics"
    ? { kind: "topics", topics: view.covered.topics }
    : { kind: "readouts" };
}

function getSheetGraphKind(view: CertificateView): SheetGraphKind {
  if (view.graph.kind === "ladder") {
    return "ladder";
  }

  return view.graph.label ? "labelledRoute" : "route";
}

export type FittedSheet = {
  covered: SheetCovered;
  moreTopics: string | null;
  name: ShapedText;
  title: ShapedText;
};

/** Counted after fitting, which can list fewer topics than the view offered. */
async function getMoreTopics({
  covered,
  locale,
  view,
}: {
  covered: SheetCovered;
  locale: string;
  view: CertificateView;
}): Promise<string | null> {
  const hidden =
    covered?.kind === "topics" && view.covered?.kind === "topics"
      ? view.covered.total - covered.topics.length
      : 0;

  if (hidden <= 0) {
    return null;
  }

  const t = await getExtracted({ locale });

  return t({
    description: "After “Topics covered” when the certificate lists only the first six topics.",
    message: "and {count} more",
    values: { count: formatCount({ count: hidden, locale }) },
  });
}

export async function fitSheet({
  locale,
  scale,
  view,
}: {
  locale: string;
  scale: number;
  view: CertificateView;
}): Promise<FittedSheet> {
  const shaping = { locale, scale, view };
  const name = getName(shaping, SHEET.name);
  const title = getTitle(shaping, SHEET.title);

  const [nameShaped, titleShaped] = await Promise.all([
    shapeSpec({ ...name, scale: shaping.scale, spec: SHEET.name }),
    shapeSpec({ ...title, scale: shaping.scale, spec: SHEET.title }),
  ]);

  const overflow = (parts: Omit<FittedSheet, "moreTopics">) =>
    getSheetOverflow({
      covered: parts.covered,
      finePrint: view.finePrint,
      graph: getSheetGraphKind(view),
      nameHeight: parts.name.blockHeight / shaping.scale,
      titleHeight: parts.title.blockHeight / shaping.scale,
    });

  const covered =
    getCoveredFallbacks(toSheetCovered(view)).find(
      (option) => overflow({ covered: option, name: nameShaped, title: titleShaped }) <= 0,
    ) ?? null;

  const fittedTitle = await shrinkUntil({
    ...title,
    fits: (shaped) => overflow({ covered, name: nameShaped, title: shaped }) <= 0,
    scale: shaping.scale,
    shaped: titleShaped,
  });

  const fittedName = await shrinkUntil({
    ...name,
    fits: (shaped) => overflow({ covered, name: shaped, title: fittedTitle }) <= 0,
    scale: shaping.scale,
    shaped: nameShaped,
  });

  return {
    covered,
    moreTopics: await getMoreTopics({ covered, locale, view }),
    name: fittedName,
    title: fittedTitle,
  };
}

export type FittedShare = { name: ShapedText; title: ShapedText };

/** The link picture's title is muted and, past two lines at its smallest size, ends in an ellipsis. */
export async function fitLink({
  locale,
  view,
}: {
  locale: string;
  view: CertificateView;
}): Promise<FittedShare> {
  const shaping = { locale, scale: 1, view };
  const name = getName(shaping, SHARE.link.name);

  const runs = view.title.map((run) =>
    run.color === CERTIFICATE_COLORS.ink ? { ...run, color: CERTIFICATE_COLORS.muted } : run,
  );

  const { largest, smallest } = SHARE.link.title;

  const [nameShaped, titleShaped] = await Promise.all([
    shapeSpec({ ...name, scale: 1, spec: SHARE.link.name }),
    shapeClampedText({
      box: getBox({ runs, shaping, spec: SHARE.link.title }),
      runs,
      sizes: getSizes({ largest, scale: 1, smallest }),
    }),
  ]);

  const fittedName = await shrinkUntil({
    ...name,
    fits: (shaped) =>
      getLinkOverflow({
        graph: view.graph.kind === "ladder" ? "ladder" : "route",
        nameHeight: shaped.blockHeight,
        titleHeight: titleShaped.blockHeight,
      }) <= 0,
    scale: 1,
    shaped: nameShaped,
  });

  return { name: fittedName, title: titleShaped };
}

export async function fitPost({
  locale,
  view,
}: {
  locale: string;
  view: CertificateView;
}): Promise<FittedShare> {
  const shaping = { locale, scale: 1, view };
  const name = getName(shaping, SHARE.post.name);
  const title = getTitle(shaping, SHARE.post.title);

  const [nameShaped, titleShaped] = await Promise.all([
    shapeSpec({ ...name, scale: 1, spec: SHARE.post.name }),
    shapeSpec({ ...title, scale: 1, spec: SHARE.post.title }),
  ]);

  const overflow = (parts: FittedShare) =>
    getPostOverflow({
      graph: view.graph.kind === "ladder" ? "ladder" : "route",
      hasStats: view.stats.length > 0,
      nameHeight: parts.name.blockHeight,
      titleHeight: parts.title.blockHeight,
    });

  const fittedTitle = await shrinkUntil({
    ...title,
    fits: (shaped) => overflow({ name: nameShaped, title: shaped }) <= 0,
    scale: 1,
    shaped: titleShaped,
  });

  const fittedName = await shrinkUntil({
    ...name,
    fits: (shaped) => overflow({ name: shaped, title: fittedTitle }) <= 0,
    scale: 1,
    shaped: nameShaped,
  });

  return { name: fittedName, title: fittedTitle };
}
