import "server-only";
import { getDefaultChapterImage } from "@/lib/catalog/default-images";
import { getCourse } from "@zoonk/core/courses/get-by-slug";
import { decodeRouteParam } from "@zoonk/core/navigation/decode-route-param";
import { createCatalogOpenGraphImage } from "./catalog-opengraph-image";

type CourseRoute = { brandSlug: string; courseSlug: string };

/** The course read's tags expire it when the course changes; its chapter and lesson pages share the entry. */
async function getCourseCard(route: CourseRoute) {
  "use cache";

  const course = await getCourse(route);

  const image = await createCatalogOpenGraphImage({
    description: course?.description,
    fallbackImagePath: getDefaultChapterImage({ categories: course?.categories ?? [] }),
    imageUrl: course?.imageUrl,
    title: course?.title ?? "Zoonk",
  });

  const headers: [string, string][] = [];
  image.headers.forEach((value, key) => headers.push([key, value]));

  return { headers, png: new Uint8Array(await image.arrayBuffer()) };
}

export async function createCourseOpenGraphImage(route: CourseRoute): Promise<Response> {
  const { headers, png } = await getCourseCard({
    brandSlug: decodeRouteParam(route.brandSlug),
    courseSlug: decodeRouteParam(route.courseSlug),
  });

  return new Response(png, { headers });
}
