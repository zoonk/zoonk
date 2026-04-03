export const TEST_CASES = [
  {
    expectations: `
EVALUATION CRITERIA:

1. VISUAL COUNT: One scenario visual + one visual per finding. Must match the number of findings in the input.

2. KIND APPROPRIATENESS: Choose kind based on data structure, not for variety. Code/logs -> "code". Numeric trends -> "chart". Structured data -> "table". Systems/flows -> "diagram". Physical scenes -> "image" (last resort). Penalize "image" when a structured type fits.

3. DESCRIPTION SPECIFICITY: Descriptions must be specific enough for a visual generation system — include data values for charts, column headers for tables, code structure for snippets, node labels for diagrams. Penalize vague descriptions like "a relevant chart."

4. CONSISTENCY: Visual descriptions must match the finding text. If a finding mentions specific data, the visual should show that data.

5. LANGUAGE: Visual descriptions should use the content language where applicable.
    `,
    id: "en-web-packets-network-paths",
    userInput: {
      findings: {
        findings: [
          "The trace shows 14 stops between the office and your server, compared to 6 from headquarters; however, a few of those extra stops appear in traces to unrelated sites as well.",
          "Server logs show all requests arriving intact with correct formatting; however, response times for the affected office are three times longer than for other locations.",
          "Both offices measure similar download speeds on a general speed test; however, the affected office shows noticeably higher variation when loading pages with many small embedded resources.",
        ],
      },
      language: "en",
      scenario: {
        explanations: [
          "A device between your office and the app is sending requests along a bad route, so some messages never reach the server and others come back late.",
        ],
        scenario:
          "Your team pushes a small update to your web app, and now users in one office say pages load halfway then stall. You can reach the app from headquarters, but the problem gets worse the farther users are from the server.",
      },
    },
  },
];
