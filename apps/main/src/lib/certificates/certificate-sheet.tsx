import { type FittedSheet } from "./certificate-fit";
import { FONT_WEIGHTS } from "./certificate-fonts";
import { CertificateGraph } from "./certificate-graph";
import { TOPIC_COLUMN_WIDTH } from "./certificate-layout";
import { CERTIFICATE_COLORS } from "./certificate-palette";
import { Brand, CheckMark, QrCode, ShapedImage } from "./certificate-parts";
import { SHEET } from "./certificate-spec";
import { type CertificateView } from "./certificate-view";

type Scale = (value: number) => number;

function SheetReadouts({
  covered,
  px,
  view,
}: {
  covered: FittedSheet["covered"];
  px: Scale;
  view: CertificateView;
}) {
  if (covered?.kind !== "readouts" || view.covered?.kind !== "readouts") {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        gap: px(SHEET.covered.readoutGap),
        marginTop: px(SHEET.covered.above),
      }}
    >
      {view.covered.readouts.map((readout) => (
        <div
          key={readout.label}
          style={{ display: "flex", flexDirection: "column", gap: px(SHEET.covered.labelGap) }}
        >
          <span
            style={{
              color: CERTIFICATE_COLORS.muted,
              fontSize: px(SHEET.covered.labelSize),
              fontWeight: 500,
            }}
          >
            {readout.label}
          </span>
          <span
            style={{
              fontSize: px(SHEET.covered.readoutSize),
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

function SheetTopics({
  covered,
  px,
  view,
}: {
  covered: FittedSheet["covered"];
  px: Scale;
  view: CertificateView;
}) {
  if (covered?.kind !== "topics" || view.covered?.kind !== "topics") {
    return null;
  }

  const { topics } = SHEET;

  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: px(SHEET.covered.above) }}>
      <div
        style={{
          color: CERTIFICATE_COLORS.muted,
          display: "flex",
          fontSize: px(SHEET.covered.labelSize),
          fontWeight: 500,
          gap: px(SHEET.covered.moreGap),
        }}
      >
        <span>{view.covered.label}</span>
        {view.covered.more && (
          <span style={{ color: CERTIFICATE_COLORS.faint }}>{`· ${view.covered.more}`}</span>
        )}
      </div>

      <div
        style={{
          columnGap: px(topics.columnGap),
          display: "flex",
          flexWrap: "wrap",
          marginTop: px(SHEET.covered.listGap),
          rowGap: px(SHEET.covered.rowGap),
          width: px(topics.width),
        }}
      >
        {covered.topics.map((topic) => (
          <div
            key={topic}
            style={{ display: "flex", gap: px(topics.checkGap), width: px(TOPIC_COLUMN_WIDTH) }}
          >
            <div style={{ display: "flex", flexShrink: 0, marginTop: px(topics.checkTop) }}>
              <CheckMark size={px(topics.check)} />
            </div>
            <span style={{ fontSize: px(topics.size), lineHeight: topics.lineHeight }}>
              {topic}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SheetMeta({ px, view }: { px: Scale; view: CertificateView }) {
  const { meta } = SHEET;

  return (
    <div
      style={{
        alignItems: "center",
        color: CERTIFICATE_COLORS.muted,
        display: "flex",
        fontSize: px(meta.size),
        gap: px(meta.gap),
        height: px(meta.chipHeight),
        marginTop: px(meta.above),
      }}
    >
      {view.subject && (
        <span
          style={{
            alignItems: "center",
            background: view.subject.tint,
            borderRadius: px(meta.chipRadius),
            color: view.subject.text,
            display: "flex",
            fontSize: px(meta.chipSize),
            fontWeight: FONT_WEIGHTS.kind,
            height: px(meta.chipHeight),
            letterSpacing: "-0.005em",
            padding: `0 ${px(meta.chipPadding)}px`,
          }}
        >
          {view.subject.label}
        </span>
      )}
      <span>{view.meta}</span>
    </div>
  );
}

function SheetFacts({ px, view }: { px: Scale; view: CertificateView }) {
  const { footer } = SHEET;

  return (
    <div
      style={{ display: "flex", flexBasis: 0, flexDirection: "column", flexGrow: 1, minWidth: 0 }}
    >
      <div style={{ display: "flex", gap: px(footer.factGap) }}>
        {view.facts.map((fact) => (
          <div
            key={fact.label}
            style={{ display: "flex", flexDirection: "column", gap: px(footer.factLabelGap) }}
          >
            <span
              style={{
                color: CERTIFICATE_COLORS.muted,
                fontSize: px(footer.labelSize),
                fontWeight: 500,
              }}
            >
              {fact.label}
            </span>
            <span
              style={{
                fontFamily: "Geist Mono",
                fontSize: px(footer.valueSize),
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
          fontSize: px(footer.finePrintSize),
          lineHeight: footer.finePrintLineHeight,
          marginTop: px(footer.finePrintGap),
          maxWidth: px(footer.finePrintWidth),
        }}
      >
        {view.finePrint}
      </span>
    </div>
  );
}

function SheetFooter({ px, view }: { px: Scale; view: CertificateView }) {
  const { footer } = SHEET;

  return (
    <div
      style={{
        alignItems: "flex-end",
        borderTop: `${px(footer.rule)}px solid ${CERTIFICATE_COLORS.hairline}`,
        display: "flex",
        gap: px(footer.columnGap),
        marginTop: px(footer.above),
        paddingTop: px(footer.ruleGap),
      }}
    >
      <SheetFacts px={px} view={view} />

      <div
        style={{
          alignItems: "flex-end",
          display: "flex",
          flexDirection: "column",
          gap: px(footer.verifyGap),
          paddingBottom: px(footer.verifyBottom),
        }}
      >
        <span
          style={{
            color: CERTIFICATE_COLORS.muted,
            fontSize: px(footer.labelSize),
            fontWeight: 500,
          }}
        >
          {view.verifyLabel}
        </span>
        <span
          style={{
            fontFamily: "Geist Mono",
            fontSize: px(footer.verifySize),
            letterSpacing: 0,
            whiteSpace: "nowrap",
          }}
        >
          {view.displayUrl}
        </span>
      </div>

      <QrCode size={px(footer.qr)} url={view.qrUrl} />
    </div>
  );
}

/** The certificate itself, A4 landscape: what Print and Download give. */
export function CertificateSheet({
  fitted,
  logo,
  scale,
  view,
}: {
  fitted: FittedSheet;
  logo: string;
  scale: number;
  view: CertificateView;
}) {
  const px: Scale = (value) => value * scale;

  return (
    <div
      style={{
        background: CERTIFICATE_COLORS.paper,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: `${px(SHEET.marginY)}px ${px(SHEET.marginX)}px`,
        width: "100%",
      }}
    >
      <Brand logoSrc={logo} scale={scale} spec={SHEET.brand} />

      <span
        style={{
          color: CERTIFICATE_COLORS.muted,
          fontSize: px(SHEET.kind.size),
          fontWeight: FONT_WEIGHTS.kind,
          letterSpacing: "-0.01em",
          lineHeight: SHEET.kind.lineHeight,
          marginTop: px(SHEET.kind.above),
        }}
      >
        {view.kindLabel}
      </span>

      <ShapedImage above={px(SHEET.name.above)} text={fitted.name} />
      <ShapedImage above={px(SHEET.title.above)} text={fitted.title} />
      <SheetMeta px={px} view={view} />
      <SheetReadouts covered={fitted.covered} px={px} view={view} />
      <SheetTopics covered={fitted.covered} px={px} view={view} />

      <div style={{ display: "flex", marginTop: "auto", paddingTop: px(SHEET.graph.above) }}>
        <CertificateGraph
          ladder={SHEET.ladder}
          route={SHEET.route}
          scale={scale}
          showLabels
          view={view}
        />
      </div>

      <SheetFooter px={px} view={view} />
    </div>
  );
}
