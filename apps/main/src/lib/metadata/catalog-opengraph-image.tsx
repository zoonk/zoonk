import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { optimizeImage } from "@zoonk/core/images/optimize";
import { safeAsync } from "@zoonk/utils/error";
import { ImageResponse } from "next/og";

const ROOT_OPEN_GRAPH_IMAGE_PATH = "src/app/opengraph-image.png";
const DESCRIPTION_LINE_HEIGHT = 1.35;
const DESCRIPTION_LINE_COUNT = 5;
const DESCRIPTION_FONT_SIZE = 30;
const MAX_DESCRIPTION_LENGTH = 112;
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
  title: string;
};

type CatalogImageSource =
  | { kind: "public"; path: string }
  | { kind: "remote"; url: string }
  | { kind: "root" };

/**
 * Builds the shared catalog Open Graph image with only the course image, title,
 * and description so share cards stay clean and cache-safe.
 */
export async function createCatalogOpenGraphImage(params: CatalogOpenGraphImageParams) {
  const imageSrc = await getRenderableImageSrc({
    fallbackImagePath: params.fallbackImagePath,
    imageUrl: params.imageUrl,
  });

  return new ImageResponse(<CatalogOpenGraphImage imageSrc={imageSrc} {...params} />, {
    ...catalogOpenGraphImageSize,
  });
}

/**
 * Keeps long generated titles inside the fixed social-card canvas instead of
 * letting one unusually long course or lesson title overflow the image.
 */
function truncateText({ maxLength, text }: { maxLength: number; text: string }): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

/**
 * Longer titles need a smaller fixed type size because Open Graph images have a
 * single target canvas and cannot rely on responsive browser layout.
 */
function getTitleFontSize(title: string): number {
  if (title.length > LONG_TITLE_LENGTH) {
    return LONG_TITLE_FONT_SIZE;
  }

  if (title.length > MEDIUM_TITLE_LENGTH) {
    return MEDIUM_TITLE_FONT_SIZE;
  }

  return SHORT_TITLE_FONT_SIZE;
}

/**
 * Optional image URLs flow through conditional arrays, so this narrows them
 * before the fallback loader receives an ordered list of concrete sources.
 */
function isImageSource(source: CatalogImageSource | null): source is CatalogImageSource {
  return Boolean(source);
}

/**
 * Stored image URLs may be remote uploads or app-public fallback paths. Keeping
 * them typed avoids dynamic filesystem joins that make the build trace too much.
 */
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

/**
 * Thumbnail URLs can be remote blob URLs or local public fallback paths. The
 * renderer tries the content image first, then the route fallback, then the
 * root static share image so metadata generation never fails over artwork.
 */
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

/**
 * The first usable image should win because generated thumbnails are more
 * specific than fallback art, but a broken upload should still leave a card.
 */
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

/**
 * `next/og` renders PNG data URLs reliably, while the generated catalog art is
 * stored as WebP. Converting at the metadata boundary keeps the stored assets
 * unchanged and avoids blank share previews.
 */
async function getPngDataUrl({ image }: { image: Buffer }): Promise<string | null> {
  const { data } = await optimizeImage({ format: "png", image, quality: 92 });

  if (!data) {
    return null;
  }

  return `data:image/png;base64,${data.toString("base64")}`;
}

/**
 * Keeps remote and local image loading behind one boundary so the renderer does
 * not need to know where a thumbnail came from.
 */
async function readImageBytes(source: CatalogImageSource): Promise<Buffer | null> {
  if (source.kind === "remote") {
    return fetchRemoteImage(source.url);
  }

  if (source.kind === "public") {
    return readLocalImage(join(process.cwd(), "public", source.path));
  }

  return readLocalImage(join(process.cwd(), ROOT_OPEN_GRAPH_IMAGE_PATH));
}

/**
 * Remote thumbnails are user-facing content, so failures should degrade to the
 * next fallback image instead of breaking the metadata route.
 */
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

/**
 * Local fallback art lives in the app project so tests and previews do not need
 * production network access when a course has no generated thumbnail.
 */
async function readLocalImage(path: string): Promise<Buffer | null> {
  const { data } = await safeAsync(() => readFile(path));
  return data;
}

/**
 * The card follows a quiet course-preview layout: one image block and one text
 * block, with no labels or metadata that would compete with the course copy.
 */
function CatalogOpenGraphImage({
  description,
  imageSrc,
  title,
}: CatalogOpenGraphImageParams & { imageSrc: string }) {
  const safeTitle = truncateText({ maxLength: MAX_TITLE_LENGTH, text: title });

  const safeDescription = description
    ? truncateText({ maxLength: MAX_DESCRIPTION_LENGTH, text: description })
    : "";

  return (
    <div
      style={{
        alignItems: "center",
        background: "#ffffff",
        color: "#111111",
        display: "flex",
        fontFamily: "Arial, Helvetica, sans-serif",
        gap: 96,
        height: "100%",
        justifyContent: "center",
        padding: "72px 96px",
        width: "100%",
      }}
    >
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
          flexDirection: "column",
          gap: 28,
          justifyContent: "center",
          minWidth: 0,
          width: 560,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: getTitleFontSize(safeTitle),
            fontWeight: 800,
            lineHeight: 1.04,
          }}
        >
          {safeTitle}
        </div>

        {safeDescription && (
          <div
            style={{
              color: "#4a4a4a",
              display: "flex",
              fontSize: DESCRIPTION_FONT_SIZE,
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
  );
}
