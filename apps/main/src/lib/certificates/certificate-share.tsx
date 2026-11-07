import { type FittedShare } from "./certificate-fit";
import { FONT_WEIGHTS } from "./certificate-fonts";
import { CertificateGraph } from "./certificate-graph";
import { CERTIFICATE_COLORS } from "./certificate-palette";
import { Brand, ShapedImage } from "./certificate-parts";
import { SHARE } from "./certificate-spec";
import { type CertificateView } from "./certificate-view";

type ShareVariant = "link" | "post";

/** The certificate's white sheet with its edge and one soft shadow, on the pale ground. */
function ShareCard({ children, variant }: React.PropsWithChildren<{ variant: ShareVariant }>) {
  const spec = SHARE[variant];
  const { shadow } = SHARE;

  return (
    <div
      style={{
        background: CERTIFICATE_COLORS.ground,
        display: "flex",
        height: "100%",
        padding: spec.inset,
        width: "100%",
      }}
    >
      <div
        style={{
          background: CERTIFICATE_COLORS.paper,
          border: `1.5px solid ${CERTIFICATE_COLORS.edge}`,
          borderRadius: spec.radius,
          boxShadow: `0 ${shadow.offset}px ${shadow.blur}px ${shadow.spread}px ${CERTIFICATE_COLORS.shadow}`,
          display: "flex",
          flexBasis: 0,
          flexDirection: "column",
          flexGrow: 1,
          minWidth: 0,
          padding: `${spec.padding.top}px ${spec.padding.x}px ${spec.padding.bottom}px`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ShareBottom({ size, view }: { size: number; view: CertificateView }) {
  return (
    <div
      style={{
        color: CERTIFICATE_COLORS.muted,
        display: "flex",
        flexGrow: 1,
        fontFamily: "Geist Mono",
        fontSize: size,
        gap: size,
        justifyContent: "space-between",
        letterSpacing: 0,
      }}
    >
      <span>{view.date}</span>
      <span>{view.displayUrl}</span>
    </div>
  );
}

/** 1200 × 630, every link preview's picture: the page's `og:image`. */
export function CertificateLink({
  fitted,
  logo,
  view,
}: {
  fitted: FittedShare;
  logo: string;
  view: CertificateView;
}) {
  const { link } = SHARE;

  return (
    <ShareCard variant="link">
      <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
        <Brand logoSrc={logo} scale={1} spec={link.brand} />
        <span
          style={{
            color: CERTIFICATE_COLORS.muted,
            fontSize: link.kind.size,
            fontWeight: FONT_WEIGHTS.kind,
            letterSpacing: "-0.015em",
          }}
        >
          {view.kindLabel}
        </span>
      </div>

      <div style={{ display: "flex", marginTop: "auto" }}>
        <ShapedImage above={link.name.above} text={fitted.name} />
      </div>

      <ShapedImage above={link.title.above} text={fitted.title} />

      <div style={{ display: "flex", marginTop: link.graph.above }}>
        <CertificateGraph route={link.route} scale={1} showLabels={false} view={view} />
      </div>

      <div style={{ display: "flex", marginTop: link.bottom.above }}>
        <ShareBottom size={link.bottom.size} view={view} />
      </div>
    </ShareCard>
  );
}

/**
 * An equal share of the room the post's parts leave. A post without numbers takes a second share
 * above the graph, so a blank doesn't open over the name and the graph sits on the footer instead.
 */
function FreeSpace() {
  return <div style={{ display: "flex", flexGrow: 1 }} />;
}

function PostStats({ view }: { view: CertificateView }) {
  const { stats } = SHARE.post;

  if (view.stats.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "flex", gap: stats.gap, marginTop: stats.above }}>
      {view.stats.map((stat) => (
        <div
          key={stat.label}
          style={{ display: "flex", flexDirection: "column", gap: stats.labelGap }}
        >
          <div style={{ alignItems: "baseline", display: "flex", gap: stats.unitGap }}>
            <span
              style={{
                fontSize: stats.size,
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
                  fontSize: stats.unitSize,
                  fontWeight: FONT_WEIGHTS.kind,
                  letterSpacing: "-0.01em",
                }}
              >
                {stat.unit}
              </span>
            )}
          </div>
          <span style={{ color: CERTIFICATE_COLORS.muted, fontSize: stats.labelSize }}>
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 1080 × 1350, what Share sends as a file on phones; everything sits inside Instagram's 3:4 crop. */
export function CertificatePost({
  fitted,
  logo,
  view,
}: {
  fitted: FittedShare;
  logo: string;
  view: CertificateView;
}) {
  const { post } = SHARE;

  return (
    <ShareCard variant="post">
      <Brand logoSrc={logo} scale={1} spec={post.brand} />

      <FreeSpace />

      <span
        style={{
          color: CERTIFICATE_COLORS.muted,
          fontSize: post.kind.size,
          fontWeight: FONT_WEIGHTS.kind,
          letterSpacing: "-0.015em",
        }}
      >
        {view.kindLabel}
      </span>

      <ShapedImage above={post.name.above} text={fitted.name} />
      <ShapedImage above={post.title.above} text={fitted.title} />

      {view.stats.length === 0 && <FreeSpace />}

      <div style={{ display: "flex", marginTop: post.graph.above }}>
        <CertificateGraph route={post.route} scale={1} showLabels view={view} />
      </div>

      <PostStats view={view} />

      <div
        style={{
          borderTop: `${post.bottom.rule}px solid ${CERTIFICATE_COLORS.hairline}`,
          display: "flex",
          marginTop: post.bottom.above,
          paddingTop: post.bottom.ruleGap,
        }}
      >
        <ShareBottom size={post.bottom.size} view={view} />
      </div>
    </ShareCard>
  );
}
