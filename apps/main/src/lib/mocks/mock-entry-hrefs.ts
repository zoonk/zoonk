/** Where "Take a mock exam" leads from the exam, the Journey and Today: one place to pick. */
export const MOCK_ENTRY_HREFS = {
  choose: "/mock/new",
  mock: (id: string) => `/mock/${id}`,
} as const;
