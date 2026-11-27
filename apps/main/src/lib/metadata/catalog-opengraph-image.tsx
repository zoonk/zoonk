import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FONT_WEIGHTS, shareCardFonts } from "@/lib/certificates/certificate-fonts";
import { optimizeImage } from "@zoonk/core/images/optimize";
import { safeAsync } from "@zoonk/utils/error";
import { ImageResponse } from "next/og";
import {
  getCatalogImageDescription,
  truncateCatalogImageText,
} from "./catalog-opengraph-description";
import { OpenGraphBrand, getOpenGraphLogo } from "./open-graph-brand";
import { getOpenGraphWordBreak } from "./open-graph-word-break";

const ROOT_OPEN_GRAPH_IMAGE_PATH = "src/app/icon.svg";
const DESCRIPTION_LINE_COUNT = 5;
const DESCRIPTION_LINE_HEIGHT = 1.35;
const DESCRIPTION_FONT_SIZE = 30;
const BRAND_SIZE = 40;
const MAX_TITLE_LENGTH = 76;
const LONG_TITLE_LENGTH = 58;
const MEDIUM_TITLE_LENGTH = 38;
const LONG_TITLE_FONT_SIZE = 52;
const MEDIUM_TITLE_FONT_SIZE = 60;
const SHORT_TITLE_FONT_SIZE = 68;

export const catalogOpenGraphImageSize = { height: 630, width: 1200 };
export const catalogOpenGraphImageContentType = "image/png";

type CatalogOpenGraphImageParams = {
  description?: string | null;
  fallbackImagePath: string;
  imageUrl?: string | null;
  language: string;
  title: string;
};

type CatalogImageSource =
  | { kind: "public"; path: string }
  | { kind: "remote"; url: string }
  | { kind: "root" };

export async function createCatalogOpenGraphImage(params: CatalogOpenGraphImageParams) {
  const imageSrc = await getRenderableImageSrc({
    fallbackImagePath: params.fallbackImagePath,
    imageUrl: params.imageUrl,
  });

  return new ImageResponse(
    <CatalogOpenGraphImage imageSrc={imageSrc} logoSrc={getOpenGraphLogo("light")} {...params} />,
    { ...catalogOpenGraphImageSize, fonts: shareCardFonts },
  );
}

function getTitleFontSize(title: string): number {
  if (title.length > LONG_TITLE_LENGTH) {
    return LONG_TITLE_FONT_SIZE;
  }

  if (title.length > MEDIUM_TITLE_LENGTH) {
    return MEDIUM_TITLE_FONT_SIZE;
  }

  return SHORT_TITLE_FONT_SIZE;
}

function isImageSource(source: CatalogImageSource | null): source is CatalogImageSource {
  return Boolean(source);
}

/** Typed sources avoid dynamic filesystem joins, which make the build trace too much. */
function getImageSource(source: string | null | undefined): CatalogImageSource | null {
  if (!source) {
    return null;
  }

  if (source.startsWith("https://") || source.startsWith("http://")) {
    return { kind: "remote", url: source };
  }

  if (source.startsWith("/")) {
    return { kind: "public", path: source.slice(1) };
  }

  return null;
}

async function getRenderableImageSrc({
  fallbackImagePath,
  imageUrl,
}: {
  fallbackImagePath: string;
  imageUrl?: string | null;
}): Promise<string> {
  const sources = [
    getImageSource(imageUrl),
    getImageSource(fallbackImagePath),
    { kind: "root" } as const,
  ].filter((source) => isImageSource(source));

  return getFirstRenderableImageSrc(sources);
}

async function getFirstRenderableImageSrc(sources: CatalogImageSource[]): Promise<string> {
  const [source, ...remainingSources] = sources;

  if (!source) {
    return "";
  }

  const image = await readImageBytes(source);
  const dataUrl = image ? await getPngDataUrl({ image }) : null;

  if (dataUrl) {
    return dataUrl;
  }

  return getFirstRenderableImageSrc(remainingSources);
}

/** `next/og` renders PNG data URLs reliably, but the catalog art is stored as WebP. */
async function getPngDataUrl({ image }: { image: Buffer }): Promise<string | null> {
  const { data } = await optimizeImage({ format: "png", image, quality: 92 });

  if (!data) {
    return null;
  }

  return `data:image/png;base64,${data.toString("base64")}`;
}

async function readImageBytes(source: CatalogImageSource): Promise<Buffer | null> {
  if (source.kind === "remote") {
    return fetchRemoteImage(source.url);
  }

  if (source.kind === "public") {
    return readLocalImage(join(process.cwd(), "public", source.path));
  }

  return readLocalImage(join(process.cwd(), ROOT_OPEN_GRAPH_IMAGE_PATH));
}

async function fetchRemoteImage(url: string): Promise<Buffer | null> {
  const { data } = await safeAsync(async () => {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Image request failed with ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  });

  return data;
}

async function readLocalImage(path: string): Promise<Buffer | null> {
  const { data } = await safeAsync(() => readFile(path));
  return data;
}

function CatalogOpenGraphImage({
  description,
  imageSrc,
  language,
  logoSrc,
  title,
}: CatalogOpenGraphImageParams & { imageSrc: string; logoSrc: string }) {
  const safeTitle = truncateCatalogImageText({
    language,
    maxLength: MAX_TITLE_LENGTH,
    text: title,
  });

  const safeDescription = getCatalogImageDescription({ description, language });

  return (
    <div
      style={{
        background: "#ffffff",
        color: "#111111",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Geist",
        gap: 32,
        height: "100%",
        justifyContent: "center",
        padding: "48px 96px",
        width: "100%",
        wordBreak: getOpenGraphWordBreak(language),
      }}
    >
      <OpenGraphBrand logoSrc={logoSrc} size={BRAND_SIZE} />

      <div style={{ alignItems: "center", display: "flex", gap: 96 }}>
        <div
          style={{
            background: "#ffffff",
            border: "1px solid rgba(17, 17, 17, 0.12)",
            borderRadius: 32,
            display: "flex",
            flexShrink: 0,
            height: 360,
            justifyContent: "center",
            overflow: "hidden",
            padding: 36,
            width: 360,
          }}
        >
          {/* oxlint-disable-next-line next/no-img-element -- ImageResponse renders plain img elements, not next/image. */}
          <img
            alt=""
            src={imageSrc}
            style={{ height: "100%", objectFit: "contain", width: "100%" }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexBasis: 0,
            flexDirection: "column",
            flexGrow: 1,
            gap: 28,
            justifyContent: "center",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: getTitleFontSize(safeTitle),
              fontWeight: FONT_WEIGHTS.brand,
              letterSpacing: "-0.035em",
              lineHeight: 1.04,
              textWrap: "balance",
            }}
          >
            {safeTitle}
          </div>

          {safeDescription && (
            <div
              style={{
                color: "#4a4a4a",
                display: "block",
                fontSize: DESCRIPTION_FONT_SIZE,
                lineClamp: DESCRIPTION_LINE_COUNT,
                lineHeight: DESCRIPTION_LINE_HEIGHT,
                maxHeight: DESCRIPTION_FONT_SIZE * DESCRIPTION_LINE_HEIGHT * DESCRIPTION_LINE_COUNT,
                overflow: "hidden",
              }}
            >
              {safeDescription}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
