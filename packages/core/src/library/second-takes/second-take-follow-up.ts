import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const writeSecondTakeInputSchema = z.object({ skillId: uuidSchema(), userId: uuidSchema() });
