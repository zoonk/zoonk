import { comparisonImage } from "../../../_utils/comparison-images";

export async function GET(
  _request: Request,
  context: RouteContext<"/tasks/[taskId]/comparisons/[id]/images/[hash]">,
) {
  const bytes = await comparisonImage(await context.params);

  if (!bytes) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Type": "image/webp",
    },
  });
}
