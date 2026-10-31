import { z } from "zod";

const contentWritingSchema = z
  .object({
    generationId: z
      .string()
      .meta({
        description:
          "The run writing what the request needs: stream GET /generations/{generationId}/events, then send the same request again. A failed run is retried by sending the request again",
      }),
    status: z.literal("generating"),
  })
  .meta({ id: "ContentWriting" });

export function contentWritingResponse(description: string) {
  return {
    content: { "application/json": { schema: contentWritingSchema } },
    description,
    headers: z.object({
      Location: z
        .string()
        .meta({ description: "The run's status URL: GET /generations/{generationId}" }),
    }),
  };
}
