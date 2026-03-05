import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const countCourses = cache(() => prisma.course.count());
