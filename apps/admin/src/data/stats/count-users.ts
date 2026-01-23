import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const countUsers = cache(() => prisma.user.count());
