export const TEST_CASES = [
  {
    expectations: `
EVALUATION CRITERIA:

1. INTERPRETATION COUNT: Exactly one interpretation set per finding (3 statements + 1 feedback each).

2. QUALITY TIERS: Each set must have exactly one "best", one "overclaims", and one "dismissive" statement. The "best" should acknowledge both what the evidence shows and its limits. "overclaims" should read too much into it. "dismissive" should dismiss relevant evidence.

3. PERSPECTIVE CONSISTENCY: All interpretations must be written from the perspective of someone who believes the given explanation. They should make sense for that specific hunch.

4. SIMILAR LENGTH AND TONE: All 3 statements for a finding must be similar in length. The quality difference should be in the reasoning, not in how carefully each one is written. The "best" should NOT be obviously best by being longer or more detailed.

5. FEEDBACK QUALITY: Feedback should explain why the best reading is best — not just restate the statement.

6. LANGUAGE: All content must be in the specified language. Only JSON field names and enum values should be in English.
    `,
    id: "en-web-packets-network-paths",
    userInput: {
      explanationIndex: 0,
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
          "The app update changed what each message contains, and the server is rejecting certain requests because important information is missing or malformed.",
          "A machine on the local network is using the wrong identity details, so replies are being sent to the wrong place even though the requests leave successfully.",
          "The slowdown is coming from one overloaded link in the chain, where traffic is piling up and causing timeouts before the full exchange can finish.",
        ],
        scenario:
          "Your team pushes a small update to your web app, and now users in one office say pages load halfway then stall. You can reach the app from headquarters, but the problem gets worse the farther users are from the server.",
      },
    },
  },
];
