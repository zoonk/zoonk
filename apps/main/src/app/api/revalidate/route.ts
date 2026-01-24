import { getStringArray } from "@zoonk/utils/json";
import { revalidateTag } from "next/cache";

export async function POST(request: Request) {
  const secret = request.headers.get("x-revalidate-secret");

  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = getStringArray(await request.json(), "tags");

  if (tags.length === 0) {
    return Response.json({ error: "Invalid tags" }, { status: 400 });
  }

  for (const tag of tags) {
    revalidateTag(tag, "max");
  }

  return Response.json({ revalidated: tags });
}
