import { z } from "zod";

const pointSchema = z.tuple([z.number(), z.number()]);

const baseMapProjectionSchema = z.object({
  kind: z.enum(["albersUsa", "azimuthalEqualArea", "conicEqualArea", "equalEarth", "mercator"]),
  parallels: pointSchema.optional(),
  rotate: z.tuple([z.number(), z.number(), z.number()]).optional(),
  scale: z.number(),
  translate: pointSchema,
});

const regionToneSchema = z.enum(["context", "focus", "groupA", "groupB", "groupC"]);

export const baseMapDrawingSchema = z.object({
  height: z.number(),
  insets: z.array(
    z.object({ height: z.number(), width: z.number(), x: z.number(), y: z.number() }),
  ),
  labels: z.array(
    z.object({
      angle: z.number(),
      key: z.string().nullable(),
      kind: z.enum(["region", "street"]),
      text: z.string(),
      x: z.number(),
      y: z.number(),
    }),
  ),
  legend: z.array(z.object({ key: z.string(), tone: regionToneSchema })),
  maxZoom: z.number(),
  projection: baseMapProjectionSchema,
  regions: z.array(
    z.object({ id: z.string(), name: z.string(), path: z.string(), tone: regionToneSchema }),
  ),
  sphere: z.string().nullable(),
  streets: z.array(z.object({ name: z.string(), path: z.string() })),
  width: z.number(),
});

export type BaseMapDrawing = z.infer<typeof baseMapDrawingSchema>;
export type BaseMapProjection = z.infer<typeof baseMapProjectionSchema>;
export type BaseMapRegionTone = z.infer<typeof regionToneSchema>;
