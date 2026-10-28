export function getCourseHref({
  brandSlug,
  courseSlug,
}: {
  brandSlug: string;
  courseSlug: string;
}) {
  return `/b/${brandSlug}/c/${courseSlug}` as const;
}
