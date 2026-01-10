import "server-only";

import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getCourseSuggestionById = cache(async (id: number) =>
  prisma.courseSuggestion.findUnique({ where: { id } }),
);
