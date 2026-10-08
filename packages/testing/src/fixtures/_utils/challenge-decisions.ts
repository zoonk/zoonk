/** The decisions of `challengeCaseFixture`, one function each. */

/** The week that passes before the last decision, with the new numbers. */
const ONE_WEEK_LATER = {
  label: "One week later",
  panel: {
    metrics: [
      { label: "Version A", value: "3.1%" },
      { label: "Version B", note: "+0.6", value: "3.7%" },
    ],
    note: "9,800 visits per version · 8 days of testing",
  },
};

/** The opening decision: the product manager wants to launch after one day. */
export function startDecision() {
  return {
    choices: [
      {
        effects: [
          { change: 20, meter: "risk" },
          { change: 10, meter: "patience" },
        ],
        id: "launch",
        next: "launched",
        notes: [
          {
            kind: "improve" as const,
            skill: "significance",
            text: "You decided on one day of data. A gap this small often comes from chance.",
          },
        ],
        quality: "weak" as const,
        replies: [{ from: "product", text: "Great, shipping it now!" }],
        text: "Go ahead and launch",
      },
      {
        effects: [
          { change: -10, meter: "risk" },
          { change: -10, meter: "patience" },
        ],
        id: "ask-sample",
        next: "report",
        notes: [
          {
            kind: "good" as const,
            skill: "sample",
            text: "You asked how much data there was before deciding.",
          },
        ],
        quality: "fair" as const,
        replies: [
          { from: "product", text: "About 1,200 each. Why?" },
          { from: "data", text: "That's not many visits for a gap this small." },
        ],
        text: "How many people saw each version?",
      },
      {
        effects: [
          { change: -30, meter: "risk" },
          { change: -10, meter: "patience" },
        ],
        id: "ask-ai",
        next: "report",
        notes: [
          {
            kind: "good" as const,
            skill: "significance",
            text: "You checked whether the gap could be chance before deciding.",
          },
        ],
        quality: "strong" as const,
        replies: [
          {
            from: "ai",
            text: "With 1,200 visits per version, 3.1% vs. 3.4% could be pure chance (p ≈ 0.6). We need a lot more visits.",
          },
          { from: "data", text: "Agreed. I'd wait a full week so we catch a weekend too." },
        ],
        text: "Ask the AI to check if the difference is real",
      },
    ],
    id: "start",
    messages: [{ from: "product", text: "B won! 3.4% vs. 3.1%. Can I launch it today?" }],
    prompt: "What do you do?",
  };
}

/** After launching early, the data scientist has doubts. */
export function launchedDecision() {
  return {
    choices: [
      {
        effects: [{ change: -20, meter: "risk" }],
        id: "roll-back",
        next: "result",
        notes: [
          {
            kind: "good" as const,
            skill: "sample",
            text: "You went back to testing when the data was thin.",
          },
        ],
        quality: "strong" as const,
        replies: [{ from: "product", text: "Fine, one more week." }],
        text: "Roll it back and keep testing",
        timeJump: ONE_WEEK_LATER,
      },
      {
        effects: [{ change: 20, meter: "risk" }],
        id: "keep-live",
        next: "too-early",
        notes: [
          {
            kind: "improve" as const,
            skill: "sample",
            text: "One day of data can't tell a real gain from chance.",
          },
        ],
        quality: "weak" as const,
        replies: [],
        text: "Keep it live",
      },
    ],
    id: "launched",
    messages: [{ from: "data", text: "Wait, the test ran for one day. Are we sure?" }],
    prompt: "{{data}} has doubts. What now?",
  };
}

/** What to tell the product manager at 3 pm. */
export function reportDecision() {
  return {
    choices: [
      {
        effects: [{ change: -20, meter: "patience" }],
        id: "explain-p",
        next: "result",
        notes: [
          {
            example:
              "If the two buttons were the same, a gap like this would show up all the time.",
            kind: "improve" as const,
            skill: "explaining",
            text: "You explained it to {{product}} with “p-value.” Not everyone is a data person.",
          },
        ],
        quality: "fair" as const,
        replies: [{ from: "product", text: "I have no idea what that means, but OK." }],
        text: "The p-value is 0.6, so it isn't significant.",
        timeJump: ONE_WEEK_LATER,
      },
      {
        effects: [
          { change: -5, meter: "patience" },
          { change: -10, meter: "risk" },
        ],
        id: "explain-plain",
        next: "result",
        notes: [
          {
            kind: "good" as const,
            skill: "explaining",
            text: "You explained the risk in plain words.",
          },
        ],
        quality: "strong" as const,
        replies: [{ from: "product", text: "Makes sense. One more week, then." }],
        text: "A gap this small shows up by chance all the time. One more week will tell us.",
        timeJump: ONE_WEEK_LATER,
      },
      {
        effects: [{ change: 20, meter: "risk" }],
        id: "launch-anyway",
        next: "too-early",
        notes: [
          {
            kind: "improve" as const,
            skill: "significance",
            text: "You launched even though the gap could be chance.",
          },
        ],
        quality: "weak" as const,
        replies: [],
        text: "Let's just launch and see.",
      },
    ],
    id: "report",
    messages: [{ from: "product", text: "So what do I tell the team at 3 pm?" }],
    prompt: "What do you tell {{product}}?",
  };
}

/** A week later, with the new numbers. */
export function resultDecision() {
  return {
    choices: [
      {
        effects: [{ change: -20, meter: "risk" }],
        id: "ship",
        next: "shipped",
        notes: [
          {
            kind: "good" as const,
            skill: "sample",
            text: "You waited for enough data, then decided.",
          },
        ],
        quality: "strong" as const,
        replies: [],
        text: "Launch B for everyone",
      },
      {
        effects: [{ change: -30, meter: "patience" }],
        id: "wait-more",
        next: "too-late",
        notes: [
          {
            kind: "improve" as const,
            skill: "significance",
            text: "The evidence was already strong. Waiting longer only delayed the gain.",
          },
        ],
        quality: "fair" as const,
        replies: [],
        text: "Wait another week",
      },
    ],
    id: "result",
    messages: [
      {
        from: "ai",
        text: "If the buttons were the same, a gap like this would show up in only 2 of every 100 tests (p ≈ 0.02).",
      },
    ],
    prompt: "Now what?",
  };
}
