export const TEST_CASES = [
  {
    expectations: `
EVALUATION CRITERIA:

1. ACTION COUNT: 5-6 actions total.

2. QUALITY DISTRIBUTION: 1-2 critical (directly test the core question), 2-3 useful (valuable supporting evidence), 1-2 weak (tangentially related). Penalize severely skewed distributions.

3. DOMAIN APPROPRIATENESS: Actions should use domain-appropriate language. For networking: check logs, trace routes, run diagnostics. Actions should feel like things a real investigator would do in this domain.

4. COVERAGE: Actions should cover different investigation angles — some that would confirm the best explanation, some that test alternatives, some tangential.

5. LANGUAGE: All action labels must be in the specified language.
    `,
    id: "en-web-packets-network-paths",
    userInput: {
      accuracy: {
        accuracies: ["best", "partial", "partial", "wrong"],
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
