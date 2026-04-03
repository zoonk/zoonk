export const TEST_CASES = [
  {
    expectations: `
EVALUATION CRITERIA:

1. TIER DISTRIBUTION: There must be exactly one "best", at least one "partial", and at least one "wrong". Penalize if any tier is missing.

2. DOMAIN CORRECTNESS: The "best" explanation should be the one most supported by domain knowledge for the given topic and concepts. The accuracy assignment should reflect real-world factual correctness, not just plausibility.

3. PARTIAL VS WRONG: "partial" explanations should have genuine elements of truth — they explain part of the problem but miss the key insight. "wrong" explanations should be factually incorrect for the domain, even if they sound plausible. Penalize if a "wrong" explanation actually has significant truth to it, or if a "partial" is completely off-base.

4. OUTPUT LENGTH: The output should contain exactly as many accuracy values as there are explanations in the input. No more, no less.
    `,
    id: "en-web-packets-network-paths",
    userInput: {
      concepts: [
        "Network Packets",
        "Packet Headers",
        "Source Address",
        "Destination Address",
        "Hop",
        "Round Trip",
        "Path Through a Network",
      ],
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
      topic: "Packets and Network Paths",
    },
  },
];
