import { z } from "zod";

export const mockLeftOutSchema = z
  .array(
    z
      .object({
        name: z
          .string()
          .nullable()
          .meta({
            description: "The notice's name for the part; null for the whole exam's formats",
          }),
        part: z
          .enum([
            "listening",
            "numeric",
            "practical",
            "shortAnswer",
            "speaking",
            "written",
            "writtenInFull",
          ])
          .meta({
            description:
              "`listening`, `speaking`, `practical`: a section a mock can't run yet. `written`: a written part with no essay in the bank yet, practiced in essay sessions. `writtenInFull`: a written part only full mocks ask (half of a day leaves it out). `numeric`, `shortAnswer`: questions answered with a number or a few words, which mocks ask as multiple choice",
          }),
      })
      .meta({ id: "MockLeftOut" }),
  )
  .meta({
    description: "What it leaves out of the real exam, each with why: say each on the mock",
  });
