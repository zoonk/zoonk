import { type LessonVisual } from "@zoonk/ai/tasks/v2/visuals/schema";
import { getBaseLanguage } from "@zoonk/utils/languages";
import { findMarkdownTables, findRaggedTableRows } from "@zoonk/utils/markdown-table";
import { normalizeString } from "@zoonk/utils/string";

/**
 * What a learner can be asked to look at: a picture (a scene, a diagram, a map, an infographic),
 * numbered drawings or charts compared side by side (`panels`), a table, a chart or a timeline. A
 * screen or question whose words point at one ("na imagem", "no diagrama", "Desenho 2", "the
 * table below", "no gráfico") must show it, never describe it in words instead.
 */
const VISUAL_KINDS = ["chart", "image", "panels", "table", "timeline"] as const;

type VisualKind = (typeof VISUAL_KINDS)[number];

type VisualPatterns = Readonly<Record<VisualKind, readonly RegExp[]>>;

/**
 * Phrases that point the learner at something on the screen, compared without accents or case
 * and with punctuation as spaces. They need a pointing word ("na", "the … below", "observe a"),
 * so a picture that's part of a story ("the mayor's photo on the poster", "sua imagem pessoal"),
 * a figure of speech or the periodic table never count. Numbered drawings ("Desenho 1"), a
 * second chart ("Gráfico 2") and "the two drawings" are panels: several drawings compared side
 * by side, which only a picture with numbered panels shows.
 */
const EN_PATTERNS: VisualPatterns = {
  chart: [
    / (?:in|on|from) the (?:graph|chart|plot|bar chart|line chart|line graph|bar graph) /u,
    / the (?:graph|chart|plot) (?:below|above|shows) /u,
  ],
  image: [
    / (?:in|on) the (?:picture|photo|illustration|cartoon|drawing|diagram|infographic|flowchart|schematic)s? /u,
    / the (?:image|picture|photo|figure|illustration|map|diagram|infographic|flowchart) (?:below|above|shows) /u,
    / (?:look at|see|in) the (?:image|figure) (?:below|above) /u,
    / look at the (?:image|picture|photo|figure|map|diagram|infographic|flowchart) /u,
    / (?:image|picture|figure|photo) [0-9]+ /u,
  ],
  panels: [
    / drawing [0-9]+ /u,
    / (?:chart|graph) [2-9] /u,
    / the (?:two|three) (?:pictures|drawings) /u,
  ],
  table: [/ (?:in|from) the table /u, / the table (?:below|above|shows) /u, / a table shows /u],
  timeline: [/ (?:on|in) the timeline /u, / the timeline (?:below|above|shows) /u],
};

const PATTERNS: Readonly<Record<string, VisualPatterns>> = {
  de: {
    chart: [/ (?:im|auf dem) (?:diagramm|schaubild) /u, / das diagramm (?:unten|zeigt) /u],
    image: [
      / (?:auf|in) dem (?:bild|foto|schema) /u,
      / (?:auf|in) den bildern /u,
      / (?:auf|in) der (?:karte|skizze|infografik|abbildung) /u,
      / im schema /u,
      / bild [0-9]+ /u,
    ],
    panels: [],
    table: [/ (?:in|aus) der tabelle /u, / die tabelle (?:unten|zeigt) /u],
    timeline: [/ (?:auf dem|am) zeitstrahl /u],
  },
  en: EN_PATTERNS,
  es: {
    chart: [/ en el (?:grafico|diagrama) /u, / el grafico (?:muestra|siguiente|de abajo) /u],
    image: [
      / en (?:la|las) (?:imagen|imagenes|foto|fotos|ilustracion|vineta|figura|infografia) /u,
      / (?:observa|mira) (?:la|las) (?:imagen|imagenes|foto|figura) /u,
      / (?:observa|mira) el (?:mapa|diagrama|esquema) /u,
      / en el (?:dibujo|mapa|diagrama|esquema) /u,
      / el (?:mapa|diagrama|esquema) (?:muestra|siguiente|de abajo) /u,
      / imagen [0-9]+ /u,
    ],
    panels: [
      / dibujo [0-9]+ /u,
      / grafico [2-9] /u,
      / (?:los|las) (?:dos|tres) (?:imagenes|dibujos) /u,
    ],
    table: [/ en la tabla /u, / la tabla (?:muestra|siguiente|de abajo) /u],
    timeline: [/ en la linea de tiempo /u, / la linea de tiempo (?:muestra|siguiente) /u],
  },
  fr: {
    chart: [/ (?:dans|sur) le (?:graphique|diagramme) /u, / le graphique (?:ci dessous|montre) /u],
    image: [
      / (?:sur|dans) (?:l image|la photo|l illustration|la figure|les images|le schema|l infographie) /u,
      / l image (?:ci dessous|ci dessus|montre) /u,
      / (?:sur )?la carte (?:ci dessous|ci dessus|montre) /u,
      / image [0-9]+ /u,
    ],
    panels: [],
    table: [/ dans le tableau /u, / le tableau (?:ci dessous|suivant|montre) /u],
    timeline: [/ sur la frise /u],
  },
  pt: {
    chart: [
      / n[ao]s? graficos? /u,
      / (?:o|este|esse|um) grafico (?:abaixo|acima|a seguir|ao lado|mostra) /u,
    ],
    image: [
      / [nd][ao]s? (?:imagem|imagens|fotos?|fotografias?|ilustracao|ilustracoes|charges?|tirinhas?) /u,
      / na figura (?!de linguagem)/u,
      / n[ao]s? desenhos? (?!animad)/u,
      / n[ao]s? (?:diagramas?|infograficos?|fluxogramas?|organogramas?|croquis?|mapas?) /u,
      / no esquema (?:abaixo|acima|a seguir|ao lado) /u,
      / (?:observe|veja|olhe) (?:a|as|o|os) (?:imagem|imagens|figuras?|fotos?|ilustracao|desenho|mapas?|diagramas?|esquemas?|infograficos?|fluxogramas?) /u,
      / (?:a|esta|essa|o|este|esse) (?:imagem|figura|foto|desenho|mapa|diagrama|esquema|infografico|fluxograma) (?:abaixo|acima|a seguir|ao lado|mostra) /u,
      / (?:imagem|figura|foto) (?:[0-9]+|i|ii|iii|iv) /u,
    ],
    panels: [
      / (?:observe|veja|olhe) (?:as|os) (?:dois|duas|tres)? ?(?:desenhos|graficos|imagens|figuras) /u,
      / (?:os|as) (?:dois|duas|tres) (?:desenhos|imagens|figuras) /u,
      / desenho (?:[0-9]+|i|ii|iii|iv) /u,
      / grafico [2-9] /u,
    ],
    table: [
      / n[ao]s? tabelas? (?!periodica)/u,
      / (?:a|esta|essa|uma) tabela (?:abaixo|acima|a seguir|ao lado|mostra) /u,
      / n?o quadro (?:abaixo|a seguir|ao lado|mostra) /u,
    ],
    timeline: [/ na linha do tempo /u, / a linha do tempo (?:abaixo|a seguir|mostra) /u],
  },
};

function getPatterns(language: string): VisualPatterns {
  return PATTERNS[getBaseLanguage(language)] ?? EN_PATTERNS;
}

/** Lowercase, without accents, punctuation as spaces, padded so every word has a space around it. */
function normalizeForPhrases(text: string): string {
  return ` ${normalizeString(text.replaceAll("’", "'")).replaceAll(/[^\p{L}\p{N}]+/gu, " ")} `;
}

/** The kinds of visual a text points the learner at, in the content's language. */
function findVisualReferences({
  language,
  text,
}: {
  language: string;
  text: string;
}): Set<VisualKind> {
  const normalized = normalizeForPhrases(text);
  const patterns = getPatterns(language);

  const kinds = VISUAL_KINDS.filter((kind) =>
    patterns[kind].some((pattern) => pattern.test(normalized)),
  );

  return new Set(kinds);
}

/**
 * Words that name the numbered panels of one picture ("na versão 1 … na versão 2", "scenes 1 and
 * 2"), in any language: the same word before 1 and then 2.
 */
const NUMBERED_PANELS =
  /(?<!\p{L})(?<panel>\p{L}+) 1(?!\d)(?:.*(?<!\p{L})\k<panel> 2(?!\d)| \p{L}{1,3} 2(?!\d))/isu;

/**
 * Whether a text points the learner at something drawn: a picture, numbered drawings or versions it
 * compares, a chart or a timeline. A chart the app can't draw (a pie, uneven intervals) can only be
 * a picture, so a screen that points at any of them may carry one; a table is always written in
 * Markdown instead.
 */
export function pointsAtFigure({ language, text }: { language: string; text: string }): boolean {
  const kinds = findVisualReferences({ language, text });

  return (
    kinds.has("image") ||
    kinds.has("panels") ||
    kinds.has("chart") ||
    kinds.has("timeline") ||
    NUMBERED_PANELS.test(text)
  );
}

/** What a screen or question shows: its picture, its tables in Markdown and its chart or timeline. */
export type ShownVisuals = {
  hasImage: boolean;
  texts: readonly string[];
  visual: LessonVisual | null;
};

/**
 * A picture shows a table, chart or timeline too (one about how a chart is drawn, with uneven
 * intervals or a 3D effect, can only be a picture); data is better as a Markdown table or a
 * visual the app draws, which the writers are told.
 */
const SHOWS: Readonly<Record<VisualKind, (shown: ShownVisuals) => boolean>> = {
  chart: (shown) => shown.hasImage || shown.visual?.kind === "chart",
  image: (shown) => shown.hasImage,
  panels: (shown) => shown.hasImage,
  table: (shown) =>
    shown.hasImage || shown.texts.some((text) => findMarkdownTables(text).length > 0),
  timeline: (shown) => shown.hasImage || shown.visual?.kind === "timeline",
};

const MISSING: Readonly<Record<VisualKind, string>> = {
  chart:
    "Its words point at a chart, but it shows none: give it a `visual` of kind chart with the real values (or the example's values), or an `image` of it when the app can't draw it (a pie chart, uneven intervals).",
  image:
    "Its words point at a picture (a scene, a diagram, a map or an illustration), but it shows none: give it an `image` whose `prompt` describes that picture with every label and detail the words use.",
  panels:
    "Its words name numbered drawings or charts (Desenho 1, Gráfico 2) it doesn't show: put two side by side in one `image` labeled 1 and 2 (never more than two), or show one chart as a `visual` and ask about it without numbering charts.",
  table:
    "Its words point at a table, but it shows none: write the table in Markdown in its text (a header row, a `---` row, one row per line), or don't refer to a table.",
  timeline:
    "Its words point at a timeline, but it shows none: give it a `visual` of kind timeline with the dated events, or don't refer to a timeline.",
};

/**
 * Characters that draw bars, points and slopes: a chart drawn in text instead of shown. Box-drawing
 * lines stay allowed, since a terminal's output (a folder tree, a query result) uses them.
 */
const DRAWING_CHARACTERS = /[█▇▆▅▄▃▂▁▌▐■●○◆╱╲]/u;

/**
 * Whether a text draws a chart or a diagram with characters (bars of █, points of ●), which reads
 * as noise on a phone and is never accessible: data goes in a Markdown table or a visual, and
 * anything else is a picture.
 */
function drawsWithCharacters(text: string): boolean {
  return DRAWING_CHARACTERS.test(text);
}

/** A chart whose series don't have one value per category draws bars and points in the wrong place. */
function getChartProblems(visual: LessonVisual): string[] {
  if (visual.kind !== "chart") {
    return [];
  }

  const count = visual.categories.length;
  const uneven = visual.series.filter((series) => series.values.length !== count);
  const categories = visual.categories.map((category) => normalizeString(category));

  const lowest = Math.min(...visual.series.flatMap((series) => series.values));

  return [
    ...(visual.axisStart !== null && visual.axisStart > lowest
      ? [`The chart's axis starts at ${visual.axisStart}, above its lowest value (${lowest}).`]
      : []),
    ...uneven.map(
      (series) =>
        `The chart's series "${series.name}" has ${series.values.length} values for ${count} categories: give one value per category, in order.`,
    ),
    ...(new Set(categories).size === categories.length
      ? []
      : ["Two of the chart's categories are the same: each category labels one bar or point."]),
    ...(visual.series.some((series) => series.values.some((value) => !Number.isFinite(value)))
      ? ["The chart has a value that isn't a number."]
      : []),
  ];
}

/**
 * What keeps a screen or question from showing what its words point at: a picture, a table, a
 * chart or a timeline it refers to but doesn't show, a table whose rows don't match its header,
 * a chart whose data doesn't fit, or a picture and a chart on the same screen. Problems are
 * written for the writer's fix pass. `canShowImage` is false where no picture can be drawn.
 */
export function getVisualProblems({
  canShowImage = true,
  language,
  shown,
}: {
  canShowImage?: boolean;
  language: string;
  shown: ShownVisuals;
}): string[] {
  const referenced = findVisualReferences({ language, text: shown.texts.join("\n") });
  const ragged = shown.texts.flatMap((text) => findRaggedTableRows(text));

  return [
    ...[...referenced]
      .filter((kind) => !SHOWS[kind](shown))
      .map((kind) =>
        (kind === "image" || kind === "panels") && !canShowImage
          ? "Its words point at a picture, but questions here can't show one: ask about something the learner reads (a text, a table, a chart or a timeline) instead of a picture."
          : MISSING[kind],
      ),
    ...ragged.map(
      (row) =>
        `This table row doesn't have one cell per column of its header: "${row.trim()}". Give every row the header's cells.`,
    ),
    ...(shown.visual ? getChartProblems(shown.visual) : []),
    ...(shown.hasImage && shown.visual
      ? ["It has both a picture and a chart or timeline: show one of them."]
      : []),
    ...(shown.texts.some((text) => drawsWithCharacters(text))
      ? [
          "It draws a chart or diagram with characters (bars, points or an axis made of symbols): show the data as a Markdown table or a `visual`, or ask for a picture, and keep the words plain.",
        ]
      : []),
  ];
}
