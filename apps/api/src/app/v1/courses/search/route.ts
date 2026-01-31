import { errors } from "@/lib/api-errors";
import { type PaginatedResponse, createPaginatedResponse, decodeCursor } from "@/lib/pagination";
import { parseQueryParams } from "@/lib/query-params";
import { searchCourses } from "@zoonk/core/courses/search";
import { NextResponse } from "next/server";
import { z } from "zod";

const searchParamsSchema = z.object({
  cursor: z.string().optional(),
  language: z.string().min(2, "Language code is required"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  query: z.string().min(1, "Search query is required"),
});

export async function GET(request: Request): Promise<
  | NextResponse<
      PaginatedResponse<{
        id: number;
        slug: string;
        title: string;
        description: string | null;
        imageUrl: string | null;
        language: string;
        organization: {
          id: number;
          slug: string;
          name: string;
          logo: string | null;
        };
      }>
    >
  | NextResponse
> {
  const { searchParams } = new URL(request.url);

  const parsed = parseQueryParams(searchParams, searchParamsSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { cursor, language, limit, query } = parsed.data;
  const offset = cursor ? (decodeCursor(cursor) ?? 0) : 0;

  const courses = await searchCourses({
    language,
    limit: limit + 1,
    offset,
    query,
  });

  const response = createPaginatedResponse(
    courses.map((course) => ({
      description: course.description,
      id: course.id,
      imageUrl: course.imageUrl,
      language: course.language,
      organization: {
        id: course.organization.id,
        logo: course.organization.logo,
        name: course.organization.name,
        slug: course.organization.slug,
      },
      slug: course.slug,
      title: course.title,
    })),
    limit,
    offset,
    courses.length,
  );

  return NextResponse.json(response);
}
