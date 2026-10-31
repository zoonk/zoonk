import { createHash, timingSafeEqual } from "node:crypto";
import {
  COURSE_CACHE_SECRET_HEADER,
  courseContentTagsSchema,
} from "@zoonk/core/cache/course-content-tags";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateTag } from "next/cache";

const RESPONSE_HEADERS = { "Cache-Control": "no-store" };

function hasCacheSecret(request: Request): boolean {
  const expected = process.env.APP_CACHE_SECRET;
  const supplied = request.headers.get(COURSE_CACHE_SECRET_HEADER);

  if (!expected || !supplied) {
    return false;
  }

  /** Fixed-size digests keep the comparison constant-time even when header lengths differ. */
  return timingSafeEqual(
    createHash("sha256").update(expected).digest(),
    createHash("sha256").update(supplied).digest(),
  );
}

/** Internal cross-app invalidation; authentication precedes body parsing or any cache change. */
export async function POST(request: Request): Promise<Response> {
  if (!hasCacheSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { headers: RESPONSE_HEADERS, status: 401 });
  }

  const { data, error } = await safeAsync(async (): Promise<unknown> => request.json());
  const body = courseContentTagsSchema.safeParse(data);

  if (error || !body.success) {
    return Response.json(
      { error: "Invalid cache tags" },
      { headers: RESPONSE_HEADERS, status: 400 },
    );
  }

  const tags = [...new Set(body.data.tags)];

  tags.forEach((tag) => {
    revalidateTag(tag, { expire: 0 });
  });

  return Response.json({ revalidated: tags.length }, { headers: RESPONSE_HEADERS });
}
