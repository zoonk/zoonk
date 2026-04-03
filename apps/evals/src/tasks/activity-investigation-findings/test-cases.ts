export const TEST_CASES = [
  {
    expectations: `
EVALUATION CRITERIA:

1. FINDING COUNT: Exactly one finding per action.

2. AMBIGUITY: Every finding MUST have a complicating factor — a clause that introduces doubt or an alternative interpretation (e.g., "however" in English). If any finding presents clear, unambiguous evidence, penalize.

3. FINDINGS ARE RAW EVIDENCE: Findings should describe what the learner observes/discovers — not interpretations or judgments about what it means.

4. CONSISTENCY: Findings must be factually consistent with the scenario and domain.

5. LANGUAGE: All finding texts must be in the specified language. Complicating factor connectives must use the target language's equivalent.
    `,
    id: "en-web-packets-network-paths",
    userInput: {
      accuracy: {
        accuracies: ["best", "partial", "partial", "wrong"],
      },
      actions: {
        actions: [
          { label: "Trace the route from the affected office to your server", quality: "critical" },
          { label: "Check the app server logs for rejected requests", quality: "useful" },
          { label: "Compare network speeds at both offices", quality: "useful" },
          { label: "Ask users if other websites are also slow", quality: "weak" },
          { label: "Review the recent code changes in the update", quality: "useful" },
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
