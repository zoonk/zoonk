import "server-only";
import { prisma } from "@zoonk/db";
import { optimizeImage } from "../../images/optimize-image";
import { uploadImage } from "../../images/upload-image";
import { fetchDocument } from "../sources/fetch-document";

/**
 * Our own copy, rasterized: a site's SVG could carry scripts, and its address can change or vanish.
 * Throws when the download, conversion or upload fails, so the caller's step retries it.
 */
async function copyImage({ fileName, url }: { fileName: string; url: string }): Promise<string> {
  const fetched = await fetchDocument(url);

  if (!fetched.contentType.startsWith("image/")) {
    throw new Error(`Not an image: ${fetched.url}`);
  }

  const optimized = await optimizeImage({ image: Buffer.from(fetched.bytes) });

  if (optimized.error) {
    throw optimized.error;
  }

  const uploaded = await uploadImage({ fileName, image: optimized.data });

  if (uploaded.error) {
    throw uploaded.error;
  }

  return uploaded.data;
}

/** Internal workflow bridge for research. Keeps a logo the brand already has. */
export async function copyBrandLogo({
  iconUrl,
  organizationId,
}: {
  iconUrl: string;
  organizationId: string;
}): Promise<void> {
  const brand = await prisma.organization.findUnique({
    select: { logo: true },
    where: { id: organizationId },
  });

  if (!brand || brand.logo) {
    return;
  }

  const logo = await copyImage({ fileName: `brands/${organizationId}/logo.webp`, url: iconUrl });

  await prisma.organization.updateMany({
    data: { logo },
    where: { id: organizationId, logo: null },
  });
}

/** Internal workflow bridge for research. Keeps an image the product already has. */
export async function copyProductImage({
  imageUrl,
  productId,
}: {
  imageUrl: string;
  productId: string;
}): Promise<void> {
  const product = await prisma.product.findUnique({
    select: { imageUrl: true },
    where: { id: productId },
  });

  if (!product || product.imageUrl) {
    return;
  }

  const copied = await copyImage({ fileName: `products/${productId}/image.webp`, url: imageUrl });

  await prisma.product.updateMany({
    data: { imageUrl: copied },
    where: { id: productId, imageUrl: null },
  });
}
