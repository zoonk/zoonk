import { prisma } from "../index";
import { writeSeedLibrary } from "./seed/index";

try {
  await writeSeedLibrary(prisma);
} finally {
  await prisma.$disconnect();
}
