/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { choiceCheck, interactionCheck } from "./activity-checks";

/** History and society, reasoning and writing: one valid activity per template. */
export const societyReasoningActivities = {
  argumentBuilder: {
    check: interactionCheck,
    fields: {
      claim: "Romeo's love is impulsive.",
      evidence: [
        {
          citation: "Act 2, Scene 2",
          id: "e1",
          isStrong: true,
          quote: "It is too rash, too unadvised, too sudden.",
          why: "It names the speed.",
        },
        {
          citation: "Act 1, Scene 1",
          id: "e2",
          isStrong: false,
          quote: "O brawling love!",
          why: "It is about Rosaline.",
        },
      ],
      reasoning: [
        {
          id: "r1",
          isStrong: true,
          text: "Juliet herself sees the rush.",
          why: "It ties the quote to the claim.",
        },
        {
          id: "r2",
          isStrong: false,
          text: "Love is common in plays.",
          why: "It says nothing about Romeo.",
        },
      ],
    },
    prompt: "Build the argument.",
    template: "argumentBuilder",
  },
  categorize: {
    check: interactionCheck,
    fields: {
      groups: [
        { id: "chemical", label: "New substance", rule: "Something new forms." },
        { id: "physical", label: "Same substance", rule: "Only the form changes." },
      ],
      items: [
        { groupId: "chemical", id: "i1", text: "Burning wood", why: "Ash and gas form." },
        { groupId: "physical", id: "i2", text: "Melting ice", why: "It is still water." },
        { groupId: "chemical", id: "i3", text: "Rusting iron", why: "Iron oxide forms." },
      ],
    },
    prompt: "Sort each change.",
    template: "categorize",
  },
  causeEffectChain: {
    check: interactionCheck,
    fields: {
      links: [
        { from: "plow", to: "dust", why: "Bare soil blew away." },
        { from: "drought", to: "dust", why: "Dry soil lifted." },
      ],
      nodes: [
        { id: "plow", label: "Prairie plowed for wheat", year: 1920 },
        { id: "drought", label: "Years of drought", year: 1931 },
        { id: "dust", label: "Dust storms", year: 1934 },
      ],
    },
    prompt: "Link each cause to its effect.",
    template: "causeEffectChain",
  },
  decisionTree: {
    check: interactionCheck,
    fields: {
      case: {
        answers: [
          { branch: "Needles", nodeId: "q1" },
          { branch: "In bundles", nodeId: "q2" },
        ],
        description: "Needles grow in bundles of two.",
        outcomeId: "pine",
      },
      nodes: [
        {
          branches: [
            { label: "Needles", next: "q2" },
            { label: "Broad leaves", next: "oak" },
          ],
          id: "q1",
          kind: "question",
          question: "What are the leaves like?",
        },
        {
          branches: [
            { label: "In bundles", next: "pine" },
            { label: "Single", next: "spruce" },
          ],
          id: "q2",
          kind: "question",
          question: "How do the needles grow?",
        },
        { id: "pine", kind: "outcome", label: "Pine" },
        { id: "spruce", kind: "outcome", label: "Spruce" },
        { id: "oak", kind: "outcome", label: "Oak" },
      ],
      rootId: "q1",
    },
    prompt: "Name the tree from one leaf.",
    template: "decisionTree",
  },
  findError: {
    check: interactionCheck,
    fields: {
      correction: "120 × 0.8 = 96, not 100.",
      errorStepId: "s2",
      problem: "A $100 price goes up 20%, then down 20%.",
      steps: [
        { expression: "100 * 1.2", id: "s1", result: 120, text: "Up 20%: 100 × 1.2 = 120" },
        { expression: "120 * 0.8", id: "s2", result: 100, text: "Down 20%: 120 × 0.8 = 100" },
        { id: "s3", text: "So the price is back where it started." },
      ],
      why: "The 20% off is taken from a bigger number.",
    },
    prompt: "Find the wrong step.",
    template: "findError",
  },
  mapExplorer: {
    check: choiceCheck("What kept the brewers and the workhouse safe?", [
      ["Their water didn't come from the Broad Street pump", true],
      ["The air in their buildings was cleaner", false],
    ]),
    data: { source: { title: "On the Mode of Communication of Cholera", year: 1855 } },
    fields: {
      baseMapId: "london-1854",
      places: [
        {
          id: "pump",
          label: "Broad Street pump",
          latitude: 51.51334,
          longitude: -0.13667,
          reveals: "Most of the deaths were in houses a few streets from this pump.",
        },
        {
          id: "brewery",
          label: "Brewery on Broad Street",
          latitude: 51.51348,
          longitude: -0.1358,
          reveals: "Over 70 workers and no cholera deaths. They drank beer and had their own well.",
        },
        {
          id: "workhouse",
          label: "Poland Street workhouse",
          latitude: 51.5149,
          longitude: -0.137,
          reveals: "535 people lived here and only 5 died. It had its own well.",
        },
      ],
    },
    prompt: "Tap the map to find clues.",
    template: "mapExplorer",
  },
  matchPairs: {
    check: interactionCheck,
    fields: {
      distractors: [
        { side: "right", text: "embarrassed", why: "It looks alike but means something else." },
      ],
      pairs: [
        { id: "a", left: "embarazada", right: "pregnant" },
        { id: "b", left: "éxito", right: "success" },
      ],
    },
    prompt: "Match each word to its meaning.",
    template: "matchPairs",
  },
  sourceComparison: {
    check: interactionCheck,
    fields: {
      markPrompt: "Mark who each writer says fired first.",
      sources: [
        {
          author: "A colonial captain",
          citation: { title: "Deposition of John Parker", year: 1775 },
          date: "April 1775",
          excerpt: "The regulars fired on us without any provocation.",
          id: "parker",
          passages: [{ id: "p1", isTarget: true, text: "The regulars fired on us" }],
        },
        {
          author: "A British officer",
          citation: { title: "Report of John Pitcairn", year: 1775 },
          date: "April 1775",
          excerpt: "Some of the rebels fired first from behind a wall.",
          id: "pitcairn",
          passages: [{ id: "p2", isTarget: true, text: "the rebels fired first" }],
        },
      ],
    },
    prompt: "Read both eyewitnesses.",
    template: "sourceComparison",
  },
  timeline: {
    check: interactionCheck,
    fields: {
      anchors: [{ label: "Great Pyramid built", year: -2560 }],
      end: 2000,
      events: [
        { id: "moon", label: "Moon landing", year: 1969 },
        { id: "cleo", label: "Cleopatra rules Egypt", year: -51 },
      ],
      start: -3000,
    },
    prompt: "Place each event on the timeline.",
    template: "timeline",
  },
};
