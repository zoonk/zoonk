import { PHONE_AND_LAPTOP, type Scenario } from "./shape.mts";

function seeded({
  id,
  fixture,
  screen,
  proof,
  reach = [],
  evidence = [],
  free = false,
  locale,
}: {
  id: string;
  fixture: string;
  screen: string;
  proof: string;
  reach?: Scenario["reach"];
  evidence?: string[];
  free?: boolean;
  locale?: string;
}): Scenario {
  return {
    anchors: [],
    evidence,
    id,
    prerequisites: {
      fixture,
      persona: {
        flags: [...(free ? ["--free"] : []), ...(locale ? ["--locale", locale] : [])],
        name: "maya",
      },
    },
    proof,
    reach,
    screen,
    sizes: PHONE_AND_LAPTOP.map((size) => ({ ...size, locale })),
  };
}

export const SEEDED_SCREEN_SCENARIOS: Scenario[] = [
  seeded({
    evidence: ["input"],
    fixture: "understood",
    id: "onboarding.understood.edit",
    proof: "Save",
    reach: [{ click: "Edit Goal" }],
    screen: "/start",
  }),
  seeded({
    fixture: "goal-limit",
    free: true,
    id: "plan-link.goal-limit",
    proof: "That's all the goals you can study at once",
    reach: [{ click: "Start my own plan" }],
    screen: "/plan-link/[plan]",
  }),
  {
    ...seeded({
      evidence: ['button:has-text("Remove flag")'],
      fixture: "mock",
      id: "mock.flagged.save-failed",
      proof: "Try again before you move on",
      reach: [{ click: "Flag" }],
      screen: "/mock/[mock]",
    }),
    failure: "mock-save",
  },
  seeded({
    fixture: "unit",
    id: "unit.finished",
    locale: "pt",
    proof: "I can already…",
    screen: "/content/units/[unit]",
  }),
  seeded({ fixture: "paused", id: "today.paused", proof: "Resume", screen: "/today" }),
  {
    ...seeded({
      fixture: "failed-plan",
      id: "plan.build-failed",
      proof: "Try again",
      screen: "/start/[goal]",
    }),
    failure: "plan-build",
  },
  {
    anchors: [],
    id: "login.expired",
    prerequisites: { persona: "visitor" },
    proof: "Logging in took too long. Try again.",
    reach: [],
    screen: "/login?error=auth",
    sizes: PHONE_AND_LAPTOP,
  },
  seeded({
    evidence: ['li:has([data-slot="today-row-lines"]) + li:has([data-slot="today-row-lines"])'],
    fixture: "two-practice",
    id: "today.two-practice",
    proof: "Mixed practice",
    screen: "/today",
  }),
  seeded({
    fixture: "suggested",
    id: "today.no-goal.suggested",
    proof: "Physics",
    screen: "/today",
  }),
  seeded({
    evidence: ["text=/Rematch tomorrow/"],
    fixture: "lost",
    id: "challenge.lost",
    proof: "See result",
    screen: "/challenge/[challenge]",
  }),
  seeded({
    fixture: "uploads",
    free: true,
    id: "materials.upload-limit",
    proof: "You've used your uploads",
    reach: [
      { click: "Study your own material" },
      { click: "Paste text" },
      { fill: { field: "Your text", value: "Scenario notes about ratios and proportions." } },
      { click: "Add text" },
      { wait: "You've used your uploads" },
    ],
    screen: "/start",
  }),
  {
    ...seeded({
      evidence: ['[data-slot="task-aside"]'],
      fixture: "challenge",
      id: "challenge.aside",
      proof: "Beat the Trickster",
      screen: "/challenge/[challenge]",
    }),
    sizes: [{ pointer: "keys", size: "laptop" }],
  },
  {
    ...seeded({
      evidence: ['[data-slot="task-aside"]'],
      fixture: "call",
      id: "call.aside",
      locale: "pt",
      proof: "Practice call",
      screen: "/conversation/[conversation]",
    }),
    sizes: [{ locale: "pt", pointer: "keys", size: "laptop" }],
  },
  seeded({
    evidence: [
      '[data-slot="mistakes-inbox"] > button[aria-controls]',
      '[data-slot="mistakes-inbox"] > section:not([hidden])',
    ],
    fixture: "mistakes",
    id: "mistakes.topics",
    proof: "Mistakes notebook",
    screen: "/mistakes",
  }),
  {
    anchors: [],
    evidence: [
      'button:has-text("Continue with Google") svg',
      'button:has-text("Continue with Apple") svg',
    ],
    id: "login.brand-marks",
    prerequisites: { persona: "visitor" },
    proof: "Log in or create an account",
    reach: [],
    screen: "/login",
    sizes: PHONE_AND_LAPTOP,
  },
];
