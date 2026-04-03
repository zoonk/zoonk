export const TEST_CASES = [
  {
    expectations: `
EVALUATION CRITERIA:

1. LENGTH: 2-3 sentences maximum. Penalize if longer.

2. REVEALS THE TRUTH: Must clearly explain what actually happened — the correct explanation — and why.

3. NO CONCEPT LEAKAGE: Must not explicitly name the lesson's academic concepts. Explains through the scenario, not through jargon.

4. TONE: Should feel like a satisfying reveal, not a lecture. Casual and direct.

5. LANGUAGE: Must be in the specified language.
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
