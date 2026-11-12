import { countryCatalogSchema, countryLanguageQuerySchema } from "@zoonk/core/goals/countries";
import { validationErrorResponse } from "../schemas/responses";

export const countryPaths = {
  "/countries": {
    get: {
      description:
        "All supported content countries, named and sorted in the requested language. Shared and cacheable; opening a picker never starts generation.",
      operationId: "listCountries",
      requestParams: { query: countryLanguageQuerySchema },
      responses: {
        "200": {
          content: { "application/json": { schema: countryCatalogSchema } },
          description: "Country choices",
        },
        "400": validationErrorResponse,
      },
      security: [],
      summary: "List countries",
      tags: ["Goals"],
    },
  },
};
