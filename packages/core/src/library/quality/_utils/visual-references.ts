import { type LessonVisual } from "@zoonk/ai/tasks/visuals/schema";
import { type SupportedLocale, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { findMarkdownTables, findRaggedTableRows } from "@zoonk/utils/markdown-table";
import { normalizeString } from "@zoonk/utils/string";

const VISUAL_KINDS = ["chart", "image", "panels", "table", "timeline"] as const;

type VisualKind = (typeof VISUAL_KINDS)[number];

type VisualPatterns = Readonly<Record<VisualKind, readonly RegExp[]>>;

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

const PATTERNS: Readonly<Record<SupportedLocale, VisualPatterns>> = {
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
  it: {
    chart: [/ (?:nel|sul|dal) grafico /u, / il grafico (?:qui sotto|sotto|seguente|mostra) /u],
    image: [
      / (?:nell|nella|sull|sulla|dall|dalla) (?:immagine|immagini|foto|illustrazione|vignetta|infografica|mappa|cartina) /u,
      / (?:nella|sulla|dalla) figura (?!(?:retorica|retoriche|professionale|chiave|del|della|dello|dei|degli|delle|di) )/u,
      / (?:nel|sul|dal) (?:disegno|diagramma) (?!di legge )/u,
      / (?:nello|sullo|dallo) schema /u,
      / (?:osserva|guarda) (?:l|la|le|il|lo) (?:immagine|immagini|foto|figura|mappa|cartina|diagramma|schema) /u,
      / (?:l immagine|la figura|la foto|la mappa|lo schema) (?:qui sotto|sotto|seguente|mostra) /u,
      / (?:immagine|figura|foto) [0-9]+ /u,
    ],
    panels: [
      / disegno [0-9]+ /u,
      / grafico [2-9] /u,
      / (?:le|i) (?:due|tre) (?:immagini|disegni) /u,
    ],
    table: [/ (?:nella|dalla) tabella /u, / la tabella (?:qui sotto|sotto|seguente|mostra) /u],
    timeline: [/ (?:sulla|nella) linea del tempo /u],
  },
  ja: {
    chart: [/(?:下|上|次|左|右)の(?:グラフ|図表)/u, /グラフ(?:を見|から|によると|が示)/u],
    image: [
      /(?:下|上|次|左|右)の(?:図|絵|写真|イラスト|画像|地図)/u,
      /(?:図|写真|イラスト)[0-9０-９]+(?![0-9０-９]*[枚点])/u,
      /(?:絵|写真|イラスト|画像|地図)を見(?:てください|てみましょう|てみて)/u,
    ],
    panels: [/(?:2|3|２|３|二|三)つの(?:図(?!形)|絵|写真|イラスト)/u],
    table: [/(?:下|上|次|左|右)の表(?!\p{Script=Han})/u, /この表(?:を|から|では|に|の)/u],
    timeline: [/年表(?![彰明示])/u, /(?:下|上|次|左|右)の(?:年表|タイムライン)/u],
  },
  ko: {
    chart: [/ (?:아래|위|다음)의? 그래프/u, / 그래프(?:에서|를 보|가 보여)/u],
    image: [
      / (?:아래|위|다음)의? (?:그림|사진|이미지|삽화|지도|도식|인포그래픽)/u,
      / (?:그림|사진) ?[0-9]+ /u,
      / (?:그림|사진|지도)(?:을|를) (?:보세요|봐요|봅시다|살펴보세요|살펴봐요)/u,
    ],
    panels: [/ (?:두|세) (?:그림|사진|그래프)/u],
    table: [/ (?:아래|위|다음)의? 표(?: |를|에|의|는|와|로)/u, / 표에서/u, / 표 ?[0-9]+ /u],
    timeline: [/ 연표/u, / (?:아래|위|다음)의? 타임라인/u],
  },
  pl: {
    chart: [/ na (?:wykresie|diagramie) /u, / wykres (?:ponizej|powyzej|pokazuje) /u],
    image: [
      / na (?:rysunku|zdjeciu|ilustracji|obrazku|mapie|schemacie|infografice) /u,
      / (?:spojrz|popatrz) na (?:rysunek|zdjecie|ilustracje|obrazek|mape|schemat) /u,
      / (?:rysunek|zdjecie|ilustracja|obrazek|mapa|schemat) (?:ponizej|powyzej|pokazuje) /u,
      / (?:rysunek|ilustracja|zdjecie) [0-9]+ /u,
    ],
    panels: [/ wykres [2-9] /u, / (?:dwa|trzy) (?:rysunki|obrazki|wykresy) /u],
    table: [/ (?:w|z) tabeli /u, / tabela (?:ponizej|powyzej|pokazuje) /u],
    timeline: [/ na osi czasu /u],
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
  tr: {
    chart: [/ grafikte /u, / grafige (?:gore|bak)/u, / (?:asagıdaki|yukarıdaki) grafik/u],
    image: [
      / (?:resimde|fotografta|gorselde|cizimde|haritada|semada|infografikte) /u,
      / (?:asagıdaki|yukarıdaki) (?:resim|fotograf|gorsel|sekil |sekle|cizim|harita|sema)/u,
      / (?:sekil|resim|gorsel) [0-9]+ /u,
    ],
    panels: [/ cizim [0-9]+ /u, / grafik [2-9] /u, / (?:iki|uc) (?:resim|cizim|gorsel)/u],
    table: [/ tablo(?:da|daki|ya gore) /u, / (?:asagıdaki|yukarıdaki) tablo/u],
    timeline: [/ (?:asagıdaki|yukarıdaki) zaman (?:cizelgesi|seridi|tuneli)| zaman seridi/u],
  },
};

function getPatterns(language: string): VisualPatterns {
  return PATTERNS[getSupportedLocaleFromLanguage(language)];
}

function normalizeForPhrases(text: string): string {
  return ` ${normalizeString(text.replaceAll("’", "'")).replaceAll(/[^\p{L}\p{N}]+/gu, " ")} `;
}

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

const NUMBERED_PANELS =
  /(?<!\p{L})(?<panel>\p{L}+) 1(?!\d)(?:.*(?<!\p{L})\k<panel> 2(?!\d)| \p{L}{1,3} 2(?!\d))/isu;

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

export type ShownVisuals = {
  explores?: boolean;
  hasImage: boolean;
  texts: readonly string[];
  visual: LessonVisual | null;
};

const SHOWS: Readonly<Record<VisualKind, (shown: ShownVisuals) => boolean>> = {
  chart: (shown) => shown.hasImage || shown.explores === true || shown.visual?.kind === "chart",
  image: (shown) => shown.hasImage || shown.explores === true,
  panels: (shown) => shown.hasImage,
  table: (shown) =>
    shown.hasImage || shown.texts.some((text) => findMarkdownTables(text).length > 0),
  timeline: (shown) =>
    shown.hasImage || shown.explores === true || shown.visual?.kind === "timeline",
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

const DRAWING_CHARACTERS = /[█▇▆▅▄▃▂▁▌▐■●○◆╱╲]/u;

function drawsWithCharacters(text: string): boolean {
  return DRAWING_CHARACTERS.test(text);
}

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
    ...(shown.explores === true && (shown.hasImage || shown.visual)
      ? ["It shows a template to explore and a picture, chart or timeline too: show one of them."]
      : []),
    ...(shown.texts.some((text) => drawsWithCharacters(text))
      ? [
          "It draws a chart or diagram with characters (bars, points or an axis made of symbols): show the data as a Markdown table or a `visual`, or ask for a picture, and keep the words plain.",
        ]
      : []),
  ];
}
