/* oxlint-disable no-magic-numbers -- Fixture content is literal lesson data. */
import { explained, reasonedChoice } from "./activity-checks";

export const societyReasoningActivities = {
  argumentBuilder: {
    check: explained(
      "“Too rash, too unadvised, too sudden” names the speed, and Juliet saying it herself ties the quote to the claim.",
    ),
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
    check: explained(
      "Burning and rusting make something new: ash and gas, iron oxide. Melted ice is still water.",
    ),
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
    check: explained(
      "Plowing left the soil bare and the drought dried it out, so the wind could lift it into dust storms.",
    ),
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
  findError: {
    check: explained("120 × 0.8 is 96, not 100: the 20% off is taken from the bigger number."),
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
    check: reasonedChoice("What kept the brewers and the workhouse safe?", [
      {
        isCorrect: true,
        reason:
          "The brewery and the workhouse had wells of their own, so nobody there drank from the pump.",
        text: "Their water didn't come from the Broad Street pump",
      },
      {
        isCorrect: false,
        reason:
          "Everyone on these streets breathed the same air. What differed was the water they drank.",
        text: "The air in their buildings was cleaner",
      },
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
    check: explained(
      "Embarazada, éxito and librería look like embarrassed, exit and library, but they mean pregnant, success and bookstore.",
    ),
    fields: {
      distractors: [
        {
          side: "right",
          text: "embarrassed",
          why: "Embarrassed is avergonzada in Spanish. Embarazada looks like it but means pregnant.",
        },
        {
          side: "right",
          text: "library",
          why: "A library is a biblioteca. A librería sells books: it's a bookstore.",
        },
      ],
      pairs: [
        { id: "a", left: "embarazada", right: "pregnant" },
        { id: "b", left: "éxito", right: "success" },
        { id: "c", left: "librería", right: "bookstore" },
      ],
    },
    prompt: "Match each word to its meaning.",
    template: "matchPairs",
  },
  sourceComparison: {
    check: explained(
      "Each writer says the other side fired first: the captain blames the regulars, the officer the rebels.",
    ),
    fields: {
      markPrompt: "Mark one phrase in each account.",
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
    prompt: "Mark who each eyewitness says fired first.",
    template: "sourceComparison",
  },
  timeline: {
    check: explained(
      "Cleopatra ruled about 2,500 years after the Great Pyramid was built and about 2,000 years before the Moon landing.",
    ),
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
