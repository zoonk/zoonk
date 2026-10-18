/** Course links identify the selected edition independently of the UI locale. */
export function getCourseHref({
  brandSlug,
  courseSlug,
}: {
  brandSlug: string;
  courseSlug: string;
}) {
  return `/b/${brandSlug}/c/${courseSlug}` as const;
}
