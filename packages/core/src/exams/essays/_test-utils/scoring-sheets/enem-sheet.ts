import { localizeObject } from "@zoonk/db/seed/localize";
import { buildEnemGrading } from "../../../../../../db/src/prisma/seed/library/enem/enem-grading";
import { writtenGradingSchema } from "../../../../library/exams/written-grading";

export const ENEM_GRADING = writtenGradingSchema.parse(
  localizeObject(
    buildEnemGrading({
      handbook: "enem-cartilha",
      manual: "enem-correction-manuals",
      notice: "enem-notice",
    }),
    "pt",
  ),
);
