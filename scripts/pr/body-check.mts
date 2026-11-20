import { resolve } from "node:path";
import { bodyMedia } from "./body.mts";
import { checkPictures } from "./check.mts";
import { findManifests, isRemote, manifestsAbove } from "./locate.mts";

/**
 * Checks a PR body as `pnpm pr:media check` does: every image it shows, by its path from `root`,
 * against the capture manifests above it and under `folders`.
 */
export async function checkBody({
  folders = [],
  markdown,
  repository,
  root,
}: {
  folders?: string[];
  markdown: string;
  repository: string;
  root: string;
}) {
  const { images, unsupported } = bodyMedia(markdown);
  const local = (link: string) => (isRemote(link) ? link : resolve(root, link));
  const placed = images.map((image) => ({ ...image, path: local(image.link) }));
  const pictures = placed.map(({ path }) => path);
  const named = await Promise.all(folders.map(async (folder) => findManifests(resolve(folder))));

  return checkPictures({
    body: { images: placed, markdown },
    manifests: [...manifestsAbove(pictures), ...named.flat()],
    pictures,
    repository,
    unsupported,
  });
}
