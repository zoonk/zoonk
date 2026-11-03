import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { type CertificateImageVariant } from "@zoonk/utils/certificate-links";
import { getContentLocale } from "@zoonk/utils/locale";
import { ImageResponse } from "next/og";
import { FONT_WEIGHTS, getCertificateFonts } from "./certificate-fonts";
import {
  POST,
  SHEET,
  type SheetCovered,
  type SheetGraph,
  TOPICS,
  TOPIC_COLUMN_WIDTH,
  getCoveredFallbacks,
  getPostOverflow,
  getSheetOverflow,
} from "./certificate-layout";
import { CERTIFICATE_COLORS } from "./certificate-palette";
import {
  Brand,
  CertificateLadder,
  CertificateRoute,
  QrCode,
  ShapedImage,
} from "./certificate-parts";
import { type CertificateView, getCertificateView } from "./certificate-view";
import {
  type ShapedText,
  type TextBox,
  type TextRun,
  shapeClampedText,
  shapeText,
} from "./shaped-text";

const LOGO_PATH = join(process.cwd(), "src/app/icon.svg");

const SIZES: Record<CertificateImageVariant, { height: number; width: number }> = {
  link: { height: 630, width: 1200 },
  post: { height: 1350, width: 1080 },
  print: { height: 2480, width: 3508 },
};

const SIZE_STEP = 2;
const SMALLEST_SIZE = 20;

const logoSrc = readFile(LOGO_PATH).then(
  (svg) => `data:image/svg+xml;base64,${svg.toString("base64")}`,
);

/** Sizes from `largest` down to `smallest`, in steps of 2 design units. */
function getSizes({
  largest,
  scale,
  smallest,
}: {
  largest: number;
  scale: number;
  smallest: number;
}) {
  return Array.from(
    { length: Math.floor((largest - smallest) / SIZE_STEP) + 1 },
    (_value, index) => (largest - index * SIZE_STEP) * scale,
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

type Shaping = { locale: string; view: CertificateView };

function getNameRuns(view: CertificateView): TextRun[] {
  return [
    {
      color: view.name.isPlaceholder ? CERTIFICATE_COLORS.faint : CERTIFICATE_COLORS.ink,
      text: view.name.text,
    },
  ];
}

function getNameBox({
  letterSpacing,
  lineHeight,
  maxLines,
  shaping,
  width,
}: {
  letterSpacing: number;
  lineHeight: number;
  maxLines: number;
  shaping: Shaping;
  width: number;
}): TextBox {
  return {
    lang: getTextLang({ locale: shaping.locale, text: shaping.view.name.text }),
    letterSpacing,
    lineHeight,
    maxLines,
    weight: shaping.view.name.isPlaceholder ? 560 : 650,
    width,
  };
}

function getTitleText(view: CertificateView): string {
  return view.title.map((run) => run.text).join("");
}

async function shrinkUntil({
  box,
  fits,
  runs,
  scale,
  shaped,
}: {
  box: TextBox;
  fits: (shaped: ShapedText) => boolean;
  runs: TextRun[];
  scale: number;
  shaped: ShapedText;
}): Promise<ShapedText> {
  const current = shaped.size / scale;

  if (fits(shaped) || current - SIZE_STEP < SMALLEST_SIZE) {
    return shaped;
  }

  return shapeText({
    box: { ...box, maxLines: Number.POSITIVE_INFINITY },
    fits,
    runs,
    sizes: getSizes({ largest: current - SIZE_STEP, scale, smallest: SMALLEST_SIZE }),
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

function getSheetGraph(view: CertificateView): SheetGraph {
  if (view.graph.kind === "ladder") {
    return "ladder";
  }

  return view.graph.zones.some((zone) => zone.chapters > 0) ? "labelledRoute" : "route";
}

async function fitSheet(shaping: Shaping) {
  const scale = SHEET.width / SHEET.units;
  const titleRuns = shaping.view.title;
  const nameRuns = getNameRuns(shaping.view);

  const nameBox = getNameBox({
    letterSpacing: -0.045,
    lineHeight: 1.02,
    maxLines: 2,
    shaping,
    width: 979 * scale,
  });

  const titleBox: TextBox = {
    lang: getTextLang({ locale: shaping.locale, text: getTitleText(shaping.view) }),
    letterSpacing: -0.03,
    lineHeight: 1.14,
    maxLines: 3,
    weight: 620,
    width: 860 * scale,
  };

  const [name, title] = await Promise.all([
    shapeText({
      box: nameBox,
      runs: nameRuns,
      sizes: getSizes({ largest: 92, scale, smallest: 44 }),
    }),
    shapeText({
      box: titleBox,
      runs: titleRuns,
      sizes: getSizes({ largest: 40, scale, smallest: 24 }),
    }),
  ]);

  const overflow = (parts: { covered: SheetCovered; name: ShapedText; title: ShapedText }) =>
    getSheetOverflow({
      covered: parts.covered,
      finePrint: shaping.view.finePrint,
      graph: getSheetGraph(shaping.view),
      nameHeight: parts.name.blockHeight / scale,
      titleHeight: parts.title.blockHeight / scale,
    });

  const fallbacks = getCoveredFallbacks(toSheetCovered(shaping.view));
  const covered =
    fallbacks.find((option) => overflow({ covered: option, name, title }) <= 0) ?? null;

  const shrunkTitle = await shrinkUntil({
    box: titleBox,
    fits: (shaped) => overflow({ covered, name, title: shaped }) <= 0,
    runs: titleRuns,
    scale,
    shaped: title,
  });

  const shrunkName = await shrinkUntil({
    box: nameBox,
    fits: (shaped) => overflow({ covered, name: shaped, title: shrunkTitle }) <= 0,
    runs: nameRuns,
    scale,
    shaped: name,
  });

  return { covered, name: shrunkName, scale, title: shrunkTitle };
}

function CheckMark({ size }: { size: number }) {
  return (
    <svg height={size} viewBox="0 0 16 16" width={size}>
      <path
        d="M3.5 8.5l3 3 6-7"
        fill="none"
        stroke={CERTIFICATE_COLORS.success}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.9}
      />
    </svg>
  );
}

function SheetCoveredBlock({
  covered,
  u,
  view,
}: {
  covered: SheetCovered;
  u: (value: number) => number;
  view: CertificateView;
}) {
  if (!covered || !view.covered) {
    return null;
  }

  if (view.covered.kind === "readouts") {
    return (
      <div style={{ display: "flex", gap: u(56), marginTop: u(34) }}>
        {view.covered.readouts.map((readout) => (
          <div key={readout.label} style={{ display: "flex", flexDirection: "column", gap: u(6) }}>
            <span style={{ color: CERTIFICATE_COLORS.muted, fontSize: u(12), fontWeight: 500 }}>
              {readout.label}
            </span>
            <span
              style={{
                fontSize: u(40),
                fontWeight: FONT_WEIGHTS.readout,
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              {readout.value}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const topics = covered.kind === "topics" ? covered.topics : [];
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: u(34) }}>
      <div
        style={{
          color: CERTIFICATE_COLORS.muted,
          display: "flex",
          fontSize: u(12),
          fontWeight: 500,
        }}
      >
        <span>{view.covered.label}</span>
        {view.covered.more && (
          <span style={{ color: CERTIFICATE_COLORS.faint, marginLeft: u(4) }}>
            {`· ${view.covered.more}`}
          </span>
        )}
      </div>

      <div
        style={{
          columnGap: u(TOPICS.columnGap),
          display: "flex",
          flexWrap: "wrap",
          marginTop: u(10),
          rowGap: u(8),
          width: u(TOPICS.width),
        }}
      >
        {topics.map((topic) => (
          <div key={topic} style={{ display: "flex", gap: u(TOPICS.checkGap), width: u(TOPIC_COLUMN_WIDTH) }}>
            <div style={{ display: "flex", flexShrink: 0, marginTop: u(2.5) }}>
              <CheckMark size={u(TOPICS.check)} />
            </div>
            <span style={{ fontSize: u(14.5), lineHeight: 1.4 }}>{topic}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SheetMeta({ u, view }: { u: (value: number) => number; view: CertificateView }) {
  return (
    <div
      style={{
        alignItems: "center",
        color: CERTIFICATE_COLORS.muted,
        display: "flex",
        fontSize: u(15),
        gap: u(10),
        height: u(24),
        marginTop: u(16),
      }}
    >
      {view.subject && (
        <span
          style={{
            alignItems: "center",
            background: view.subject.tint,
            borderRadius: u(6),
            color: view.subject.text,
            display: "flex",
            fontSize: u(13),
            fontWeight: FONT_WEIGHTS.kind,
            height: u(24),
            letterSpacing: "-0.005em",
            padding: `0 ${u(8)}px`,
          }}
        >
          {view.subject.label}
        </span>
      )}
      <span>{view.meta}</span>
    </div>
  );
}

function SheetGraph({
  topics,
  u,
  view,
}: {
  topics: number;
  u: (value: number) => number;
  view: CertificateView;
}) {
  if (view.graph.kind === "ladder") {
    return (
      <CertificateLadder
        graph={view.graph}
        style={{
          bandGap: u(10),
          cellGap: u(3),
          cellHeight: u(12),
          labelGap: u(9),
          labelSize: u(13),
          radius: u(3),
        }}
      />
    );
  }

  return (
    <CertificateRoute
      style={{
        height: u(34),
        labelGap: u(8),
        labelHeight: u(18),
        labelSize: u(12.5),
        ring: u(6.5),
        showLabels: true,
        square: u(7),
        squareRadius: u(3),
        station: u(3.6),
        stroke: u(3),
        tick: u(1.5),
        width: u(979),
      }}
      topics={topics}
      zones={view.graph.zones}
    />
  );
}

function SheetFooter({ u, view }: { u: (value: number) => number; view: CertificateView }) {
  return (
    <div
      style={{
        alignItems: "flex-end",
        borderTop: `${u(1)}px solid ${CERTIFICATE_COLORS.hairline}`,
        display: "flex",
        gap: u(28),
        marginTop: u(30),
        paddingTop: u(22),
      }}
    >
      <div
        style={{ display: "flex", flexBasis: 0, flexDirection: "column", flexGrow: 1, minWidth: 0 }}
      >
        <div style={{ display: "flex", gap: u(44) }}>
          {view.facts.map((fact) => (
            <div key={fact.label} style={{ display: "flex", flexDirection: "column", gap: u(5) }}>
              <span style={{ color: CERTIFICATE_COLORS.muted, fontSize: u(12), fontWeight: 500 }}>
                {fact.label}
              </span>
              <span
                style={{
                  fontFamily: "Geist Mono",
                  fontSize: u(17),
                  fontWeight: 500,
                  letterSpacing: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {fact.value}
              </span>
            </div>
          ))}
        </div>

        <span
          style={{
            color: CERTIFICATE_COLORS.faint,
            fontSize: u(11.5),
            lineHeight: 1.45,
            marginTop: u(16),
            maxWidth: u(640),
          }}
        >
          {view.finePrint}
        </span>
      </div>

      <div
        style={{
          alignItems: "flex-end",
          display: "flex",
          flexDirection: "column",
          gap: u(5),
          paddingBottom: u(2),
        }}
      >
        <span style={{ color: CERTIFICATE_COLORS.muted, fontSize: u(12), fontWeight: 500 }}>
          {view.verifyLabel}
        </span>
        <span
          style={{
            fontFamily: "Geist Mono",
            fontSize: u(14.5),
            letterSpacing: 0,
            whiteSpace: "nowrap",
          }}
        >
          {view.displayUrl}
        </span>
      </div>

      <QrCode size={u(78)} url={view.qrUrl} />
    </div>
  );
}

async function renderSheet({ logo, shaping }: { logo: string; shaping: Shaping }) {
  const { covered, name, scale, title } = await fitSheet(shaping);
  const { view } = shaping;
  const u = (value: number) => value * scale;

  return (
    <div
      style={{
        background: CERTIFICATE_COLORS.paper,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: `${u(49)}px ${u(72)}px`,
        width: "100%",
      }}
    >
      <Brand fontSize={u(22)} gap={u(10)} logoSize={u(30)} logoSrc={logo} />

      <span
        style={{
          color: CERTIFICATE_COLORS.muted,
          fontSize: u(20),
          fontWeight: FONT_WEIGHTS.kind,
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
          marginTop: u(84),
        }}
      >
        {view.kindLabel}
      </span>

      <div style={{ display: "flex", marginTop: u(16) }}>
        <ShapedImage text={name} />
      </div>

      <div style={{ display: "flex", marginTop: u(26) }}>
        <ShapedImage text={title} />
      </div>

      <SheetMeta u={u} view={view} />
      <SheetCoveredBlock covered={covered} u={u} view={view} />

      <div style={{ display: "flex", marginTop: "auto", paddingTop: u(26) }}>
        <SheetGraph
          topics={view.covered?.kind === "topics" ? view.covered.topics.length : 0}
          u={u}
          view={view}
        />
      </div>

      <SheetFooter u={u} view={view} />
    </div>
  );
}

const SHARE_CARD = {
  link: { inset: 28, padding: "44px 56px 38px", radius: 8 },
  post: { inset: 40, padding: "72px 76px 64px", radius: 10 },
} as const;

function ShareCard({ children, variant }: React.PropsWithChildren<{ variant: "link" | "post" }>) {
  const card = SHARE_CARD[variant];

  return (
    <div
      style={{
        background: CERTIFICATE_COLORS.ground,
        display: "flex",
        height: "100%",
        padding: card.inset,
        width: "100%",
      }}
    >
      <div
        style={{
          background: CERTIFICATE_COLORS.paper,
          border: `1.5px solid ${CERTIFICATE_COLORS.edge}`,
          borderRadius: card.radius,
          boxShadow: `0 ${card.radius + 4}px ${card.inset}px -12px ${CERTIFICATE_COLORS.shadow}`,
          display: "flex",
          flexDirection: "column",
          flexBasis: 0,
          flexGrow: 1,
          minWidth: 0,
          padding: card.padding,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ShareBottom({ fontSize, view }: { fontSize: number; view: CertificateView }) {
  return (
    <div
      style={{
        color: CERTIFICATE_COLORS.muted,
        display: "flex",
        fontFamily: "Geist Mono",
        fontSize,
        gap: fontSize,
        justifyContent: "space-between",
        letterSpacing: 0,
      }}
    >
      <span>{view.date}</span>
      <span>{view.displayUrl}</span>
    </div>
  );
}

const LINK_CONTENT_WIDTH = SIZES.link.width - SHARE_CARD.link.inset * 2 - 56 * 2;

async function renderLink({ logo, shaping }: { logo: string; shaping: Shaping }) {
  const { view } = shaping;

  const [name, title] = await Promise.all([
    shapeText({
      box: getNameBox({
        letterSpacing: -0.045,
        lineHeight: 1,
        maxLines: 2,
        shaping,
        width: LINK_CONTENT_WIDTH,
      }),
      runs: getNameRuns(view),
      sizes: getSizes({ largest: 96, scale: 1, smallest: 60 }),
    }),
    shapeClampedText({
      box: {
        lang: getTextLang({ locale: shaping.locale, text: getTitleText(view) }),
        letterSpacing: -0.03,
        lineHeight: 1.12,
        maxLines: 2,
        weight: 600,
        width: LINK_CONTENT_WIDTH,
      },
      runs: view.title.map((run) =>
        run.color === CERTIFICATE_COLORS.ink ? { ...run, color: CERTIFICATE_COLORS.muted } : run,
      ),
      sizes: getSizes({ largest: 42, scale: 1, smallest: 32 }),
    }),
  ]);

  return (
    <ShareCard variant="link">
      <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
        <Brand fontSize={29} gap={10} logoSize={38} logoSrc={logo} />
        <span
          style={{
            color: CERTIFICATE_COLORS.muted,
            fontSize: 25,
            fontWeight: FONT_WEIGHTS.kind,
            letterSpacing: "-0.015em",
          }}
        >
          {view.kindLabel}
        </span>
      </div>

      <div style={{ display: "flex", marginTop: "auto" }}>
        <ShapedImage text={name} />
      </div>

      <div style={{ display: "flex", marginTop: 18 }}>
        <ShapedImage text={title} />
      </div>

      <div style={{ display: "flex", marginTop: 40 }}>
        {view.graph.kind === "ladder" ? (
          <CertificateLadder
            graph={view.graph}
            style={{
              bandGap: 10,
              cellGap: 3,
              cellHeight: 14,
              labelGap: 9,
              labelSize: 21,
              radius: 4,
            }}
          />
        ) : (
          <CertificateRoute
            style={{
              height: 34,
              labelGap: 0,
              labelHeight: 0,
              labelSize: 0,
              ring: 8,
              showLabels: false,
              square: 9,
              squareRadius: 3,
              station: 4.5,
              stroke: 4,
              tick: 1.5,
              width: LINK_CONTENT_WIDTH,
            }}
            topics={view.covered?.kind === "topics" ? view.covered.topics.length : 0}
            zones={view.graph.zones}
          />
        )}
      </div>

      <div style={{ display: "flex", marginTop: 18 }}>
        <ShareBottom fontSize={21} view={view} />
      </div>
    </ShareCard>
  );
}

const POST_CONTENT_WIDTH = SIZES.post.width - SHARE_CARD.post.inset * 2 - 76 * 2;

async function fitPost(shaping: Shaping) {
  const { view } = shaping;
  const nameRuns = getNameRuns(view);
  const nameBox = getNameBox({
    letterSpacing: -0.05,
    lineHeight: 0.98,
    maxLines: 3,
    shaping,
    width: POST_CONTENT_WIDTH,
  });

  const titleBox: TextBox = {
    lang: getTextLang({ locale: shaping.locale, text: getTitleText(view) }),
    letterSpacing: -0.032,
    lineHeight: 1.1,
    maxLines: 3,
    weight: 610,
    width: POST_CONTENT_WIDTH,
  };

  const [name, title] = await Promise.all([
    shapeText({
      box: nameBox,
      runs: nameRuns,
      sizes: getSizes({ largest: 156, scale: 1, smallest: 76 }),
    }),
    shapeText({
      box: titleBox,
      runs: view.title,
      sizes: getSizes({ largest: 60, scale: 1, smallest: 38 }),
    }),
  ]);

  const overflow = (parts: { name: ShapedText; title: ShapedText }) =>
    getPostOverflow({
      graph: view.graph.kind === "ladder" ? "ladder" : "route",
      hasStats: view.stats.length > 0,
      nameHeight: parts.name.blockHeight,
      titleHeight: parts.title.blockHeight,
    });

  const shrunkTitle = await shrinkUntil({
    box: titleBox,
    fits: (shaped) => overflow({ name, title: shaped }) <= 0,
    runs: view.title,
    scale: 1,
    shaped: title,
  });

  const shrunkName = await shrinkUntil({
    box: nameBox,
    fits: (shaped) => overflow({ name: shaped, title: shrunkTitle }) <= 0,
    runs: nameRuns,
    scale: 1,
    shaped: name,
  });

  return { name: shrunkName, title: shrunkTitle };
}

async function renderPost({ logo, shaping }: { logo: string; shaping: Shaping }) {
  const { view } = shaping;
  const { name, title } = await fitPost(shaping);

  return (
    <ShareCard variant="post">
      <Brand fontSize={34} gap={10} logoSize={44} logoSrc={logo} />

      <span
        style={{
          color: CERTIFICATE_COLORS.muted,
          fontSize: 34,
          fontWeight: FONT_WEIGHTS.kind,
          letterSpacing: "-0.015em",
          marginTop: "auto",
        }}
      >
        {view.kindLabel}
      </span>

      <div style={{ display: "flex", marginTop: 16 }}>
        <ShapedImage text={name} />
      </div>

      <div style={{ display: "flex", marginTop: 34 }}>
        <ShapedImage text={title} />
      </div>

      <div style={{ display: "flex", marginTop: 76 }}>
        {view.graph.kind === "ladder" ? (
          <CertificateLadder
            graph={view.graph}
            style={{
              bandGap: 10,
              cellGap: 3,
              cellHeight: 14,
              labelGap: 9,
              labelSize: 21,
              radius: 4,
            }}
          />
        ) : (
          <CertificateRoute
            style={{
              height: 44,
              labelGap: 10,
              labelHeight: 30,
              labelSize: 21,
              ring: 9,
              showLabels: true,
              square: 10,
              squareRadius: 3,
              station: 5,
              stroke: 4.5,
              tick: 1.5,
              width: POST_CONTENT_WIDTH,
            }}
            topics={view.covered?.kind === "topics" ? view.covered.topics.length : 0}
            zones={view.graph.zones}
          />
        )}
      </div>

      {view.stats.length > 0 && (
        <div style={{ display: "flex", gap: 72, marginTop: 60 }}>
          {view.stats.map((stat) => (
            <div key={stat.label} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ alignItems: "baseline", display: "flex" }}>
                <span
                  style={{
                    fontSize: 80,
                    fontWeight: FONT_WEIGHTS.readout,
                    letterSpacing: "-0.045em",
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </span>
                {stat.unit && (
                  <span
                    style={{
                      color: CERTIFICATE_COLORS.muted,
                      fontSize: 34,
                      fontWeight: FONT_WEIGHTS.kind,
                      letterSpacing: "-0.01em",
                      marginLeft: 8,
                    }}
                  >
                    {stat.unit}
                  </span>
                )}
              </div>
              <span style={{ color: CERTIFICATE_COLORS.muted, fontSize: 25 }}>{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          borderTop: `2px solid ${CERTIFICATE_COLORS.hairline}`,
          display: "flex",
          marginTop: 52,
          paddingTop: 26,
        }}
      >
        <ShareBottom fontSize={23} view={view} />
      </div>
    </ShareCard>
  );
}

const RENDERERS = { link: renderLink, post: renderPost, print: renderSheet };

export async function renderCertificateImage({
  facts,
  variant,
}: {
  facts: CertificateFacts;
  variant: CertificateImageVariant;
}): Promise<ImageResponse> {
  const [view, fonts, logo] = await Promise.all([
    getCertificateView(facts),
    getCertificateFonts(facts.language),
    logoSrc,
  ]);

  const shaping = { locale: getContentLocale(facts.language) ?? facts.language, view };
  const content = await RENDERERS[variant]({ logo, shaping });

  return new ImageResponse(
    <div
      style={{
        color: CERTIFICATE_COLORS.ink,
        display: "flex",
        fontFamily: "Geist",
        height: "100%",
        letterSpacing: "-0.006em",
        lineHeight: 1.43,
        width: "100%",
      }}
    >
      {content}
    </div>,
    { ...SIZES[variant], fonts },
  );
}
