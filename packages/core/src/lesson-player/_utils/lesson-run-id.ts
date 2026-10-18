import { z } from "zod";

export const lessonRunIdSchema = z
  .uuid()
  .meta({ description: "The lesson run returned by the start, which answers count toward" });
