import { getCertificateDownloadDisposition } from "@/lib/certificates/certificate-download";
import { renderCertificateImage } from "@/lib/certificates/certificate-image";
import { getPublicCertificate } from "@zoonk/core/certificates/public";
import {
  CERTIFICATE_IMAGE_VARIANTS,
  getCertificateImageVersion,
  getCertificateName,
} from "@zoonk/utils/certificate-links";
import { type NextRequest } from "next/server";

/**
 * Image URLs carry a version of the name, so a rename gets new URLs at once; a day at the CDN bounds
 * how long a deleted account's or an old name's picture is still served from an old URL.
 */
const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";

/**
 * Vercel bundles routes with the same limits into one function; a limit of its own keeps the
 * certificate fonts (about 24 MB) out of the function every page runs in.
 */
export const maxDuration = 30;

export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/[lang]/c/[code]/image/[variant]">,
) {
  const { code, variant: file } = await params;
  const variant = CERTIFICATE_IMAGE_VARIANTS.find((name) => file === `${name}.png`);
  const facts = variant ? await getPublicCertificate(code) : null;

  // A locked certificate's picture is refused like an unknown one's, and never cached, so it shows
  // once its owner gets Plus.
  if (!variant || !facts) {
    return new Response(null, { headers: { "Cache-Control": "no-store" }, status: 404 });
  }

  const version = getCertificateImageVersion(facts.recipientName);

  // Anyone can work out the version of a name the learner might take later; caching this picture
  // under it would show the old name once they take it. The path is relative: behind a proxy the
  // request's own origin can be an internal one.
  if (request.nextUrl.searchParams.get("v") !== version) {
    const query = new URLSearchParams(request.nextUrl.searchParams);
    query.set("v", version);

    return new Response(null, {
      headers: { "Cache-Control": "no-store", Location: `${request.nextUrl.pathname}?${query}` },
      status: 307,
    });
  }

  const image = await renderCertificateImage({ facts, variant });

  /* Read whole before answering: a render that fails part way must answer 500, which isn't cached, rather than a cached broken picture. */
  const body = await image.arrayBuffer();
  const download = request.nextUrl.searchParams.has("download");

  return new Response(body, {
    headers: {
      "Cache-Control": CACHE_CONTROL,
      "Content-Type": "image/png",
      ...(download && {
        "Content-Disposition": getCertificateDownloadDisposition({
          name: facts.recipientName,
          title: getCertificateName(facts),
        }),
      }),
    },
  });
}
