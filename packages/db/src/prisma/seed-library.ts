import { logError } from "@zoonk/utils/logger";
import { prisma } from "../index";
import { writeSeedLibrary } from "./seed/index";

writeSeedLibrary(prisma)
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    logError(error);
    await prisma.$disconnect();
    process.exit(1);
  });
