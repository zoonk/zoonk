import "server-only";
import { getDefaultChapterImage } from "@/lib/catalog/default-images";
import { getCourse } from "@zoonk/core/courses/get-by-slug";
import { decodeRouteParam } from "@zoonk/core/navigation/decode-route-param";
import { cacheLife } from "next/cache";
import { createCatalogOpenGraphImage } from "./catalog-opengraph-image";

type CourseRoute = { brandSlug: string; courseSlug: string };

/**
 * The card as its PNG and the image response's headers, per course address: the course's read, its
 * thumbnail's download and conversion and the render happen once for the catalog's lifetime, as
 * long as the course page's own copy of the course. The course read's tags expire it when the
 * course changes, and its chapter and lesson pages, which share the card, share the entry.
 */
async function getCourseCard(route: CourseRoute) {
  "use cache";
  cacheLife("catalog");

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

/**
 * The course's share card: its thumbnail when it has one, or art for its
 * category. Chapter and lesson pages without a card of their own share it too.
 */
export async function createCourseOpenGraphImage(route: CourseRoute): Promise<Response> {
  const { headers, png } = await getCourseCard({
    brandSlug: decodeRouteParam(route.brandSlug),
    courseSlug: decodeRouteParam(route.courseSlug),
  });

  return new Response(png, { headers });
}
