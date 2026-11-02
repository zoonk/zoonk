import { z } from "zod";

export const mockFundingSchema = z
  .object({
    mockDate: z.iso.date().describe("The scheduled date of the mock this day funds."),
    mockMinutes: z.number().positive().describe("The mock's real duration in minutes."),
    setAsideMinutes: z
      .number()
      .positive()
      .describe("Exact minutes this day sets aside for that mock."),
  })
  .meta({ id: "MockFunding" });

export type MockFundingView = z.infer<typeof mockFundingSchema>;
