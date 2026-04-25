const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. SAME PLAN, SAME ORDER: Return exactly one choices object for each step in STORY_PLAN.steps, in the same order. Do not rewrite the story plan, problems, metrics, outcomes, or image prompts.

2. CHOICE QUALITY: Every step must have 3-4 choices. Choices must be plausible next moves in the professional workflow, not opinions, lesson summaries, or app instructions.

3. ANSWER MASKING: A learner who only sees the choice text should not be able to identify the best or worst answer by tone, breadth, professionalism, or scope. Avoid giveaway wording like only, just, single, local, final, complete, broad, quick, minimal, ignore, or translated equivalents.

4. DISTINCT STRATEGIES: Choices should pull different decision levers: evidence source, artifact, mechanism, workflow, timing, risk control, reversibility, or constraint. Do not make all choices near-paraphrases of the same meaning.

5. ALIGNMENT MIX: Each step must include one strong choice, at least one partial choice, and at least one weak choice. The alignment tags must not be hinted at by the text wording.

6. CONSEQUENCE QUALITY: Consequences must show what happened after the action and, for weak or partial choices, point to the better practical next move. They should not become mini-lectures.

7. METRIC EFFECTS: Metric effects must use only strings from STORY_PLAN.metrics and must match the actual consequence. Effects should reflect real tradeoffs, not generic reward or punishment.

8. STATE IMAGE PROMPTS: State image prompts must be self-contained, preserve the same entity/artifact identity from the step, and show why the result happened. They should not merely restate the consequence.

9. VOICE: Learner-facing text should sound like a grounded work-session update from a teammate or tool, not narration, corporate filler, or academic explanation.

10. FACTUAL ACCURACY: Domain-specific choices and consequences must be realistic for the profession and problem.
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-environmental-estuary-review",
    userInput: {
      chapterTitle: "Levels of organization in life",
      concepts: ["Community Level", "Ecosystem Level", "Biome Level", "Biosphere Level"],
      courseTitle: "Biology",
      explanationSteps: [
        {
          text: "A community includes populations of different species living and interacting in the same place.",
          title: "Different populations",
        },
        {
          text: "An ecosystem includes the living community plus water, soil, light, temperature, and matter-energy flows.",
          title: "Living and nonliving",
        },
        {
          text: "A biome is a large region recognized by repeated patterns of climate, vegetation, and environmental conditions.",
          title: "Large patterns",
        },
        {
          text: "The biosphere is the sum of Earth's ecosystems and the connections among living systems at planetary scale.",
          title: "Planet scale",
        },
      ],
      language: "en",
      lessonDescription:
        "Learners expand from communities to ecosystems, biomes, and the biosphere as nested ways to reason about life.",
      storyPlan: {
        intro:
          "You are a municipal environmental analyst. A dredging incident disturbed an estuary, and your supervisor needs a defensible recommendation before the state review.",
        introImagePrompt:
          "Environmental analyst desk with an estuary map, dredging zone highlighted, field notes, salinity table, and state review deadline visible.",
        metrics: ["Evidence quality", "Impact control", "Technical defensibility"],
        outcomes: {
          bad: {
            imagePrompt:
              "Public agency meeting table with a disputed environmental memo, estuary boundary marked in red, and reviewers questioning the analysis.",
            narrative:
              "The memo pauses the work briefly, but the boundary and evidence do not hold. The state asks for a broader review.",
            title: "Disputed memo",
          },
          good: {
            imagePrompt:
              "Technical review table with estuary management zones adjusted, monitoring schedule updated, and state comments mostly resolved.",
            narrative:
              "The team accepts a solid adjustment plan. There is extra monitoring, but the main risk is now controlled.",
            title: "Solid adjustment",
          },
          ok: {
            imagePrompt:
              "Environmental office with a provisional recommendation, estuary map under review, and missing data flagged on a dashboard.",
            narrative:
              "You avoid the worst call, but the evidence still has gaps. A new survey is required before final approval.",
            title: "Provisional call",
          },
          perfect: {
            imagePrompt:
              "Municipal environmental monitoring room with estuary zones, coastal corridor links, and a signed final recommendation.",
            narrative:
              "The recommendation connects local damage to the right wider systems. The state accepts the plan with clear conditions.",
            title: "Plan accepted",
          },
          terrible: {
            imagePrompt:
              "Muddy estuary edge after dredging with exposed mangrove roots, cloudy water, and an official embargo notice on a wet clipboard.",
            narrative:
              "The analysis stayed too narrow, the work continued, and the damage became visible. An embargo and investigation follow.",
            title: "Embargo issued",
          },
        },
        steps: [
          {
            imagePrompt:
              "Close view of estuary survey sheet with crab counts, shorebird counts, juvenile fish counts, and mangrove cover by sector; sector D decline highlighted.",
            problem:
              "Counts dropped in sector D after dredging. Which biological evidence should we use before arguing about water and sediment?",
          },
          {
            imagePrompt:
              "Close view of estuary monitoring panel with salinity, dissolved oxygen, turbidity, temperature, and tide readings for sector D.",
            problem:
              "The species list does not explain the drop. Which channel data belongs in the causal analysis?",
          },
          {
            imagePrompt:
              "Regional coastal map with rainfall, soil classes, vegetation bands, and the municipal estuary inside a continuous mangrove zone.",
            problem:
              "Legal wants the limit at the city boundary. Which map evidence helps set a defensible environmental boundary?",
          },
        ],
        title: "Dredging under review",
      },
      topic: "From Community to Biosphere",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-checkout-branch-debugging",
    userInput: {
      chapterTitle: "Conditional logic",
      concepts: ["If Statement", "Else If Branch", "Else Branch", "Mutually Exclusive Conditions"],
      courseTitle: "Programming",
      explanationSteps: [
        {
          text: "An if statement runs a block only when its condition is true.",
          title: "First branch",
        },
        {
          text: "Else-if branches let the program test alternatives without letting multiple branches run for one case.",
          title: "Exclusive paths",
        },
        {
          text: "An else branch handles the fallback case when no earlier condition matches.",
          title: "Fallback",
        },
      ],
      language: "en",
      lessonDescription:
        "Learners use conditional branches to make programs choose one clear path among alternatives.",
      storyPlan: {
        intro:
          "You are the engineer on call for a restaurant ordering system. Pickup orders are getting delivery fees, and support needs a safe patch.",
        introImagePrompt:
          "Engineer workstation with checkout error log, highlighted pickup order, delivery fee line, and code editor open beside support tickets.",
        metrics: ["Code quality", "Checkout accuracy", "Incident risk"],
        outcomes: {
          bad: {
            imagePrompt:
              "Checkout incident review with duplicated conditions, unresolved pickup fee tickets, and a rollback note on the release board.",
            narrative:
              "The patch reduces a few reports but leaves overlapping paths. Support keeps finding orders with the wrong fee.",
            title: "Patch questioned",
          },
          good: {
            imagePrompt:
              "Code review screen showing clearer checkout branches, passing tests, and a few follow-up notes from the reviewer.",
            narrative:
              "The fee logic is mostly stable. A reviewer asks for one cleanup, but the production incident is contained.",
            title: "Mostly stable",
          },
          ok: {
            imagePrompt:
              "Checkout dashboard with fewer failed orders, one warning still open, and test results marked partially complete.",
            narrative:
              "The visible bug slows down, but the branch structure is still fragile. The team schedules a follow-up fix.",
            title: "Fragile fix",
          },
          perfect: {
            imagePrompt:
              "Code editor with mutually exclusive checkout branches, green test suite, and support dashboard showing resolved fee tickets.",
            narrative:
              "Each order type now follows one fee path. The tests cover the edge cases, and support closes the incident.",
            title: "Incident closed",
          },
          terrible: {
            imagePrompt:
              "Production checkout dashboard with rising fee errors, urgent rollback banner, and angry support tickets piling up.",
            narrative:
              "The patch adds another overlapping path. Fees drift further, support escalates, and the release is rolled back.",
            title: "Rollback",
          },
        },
        steps: [
          {
            imagePrompt:
              "Close view of checkout fee code showing separate if blocks for delivery, pickup, and courier orders with a pickup order matching multiple checks.",
            problem:
              "Pickup orders are being charged delivery fees. What should we change in the branching structure?",
          },
          {
            imagePrompt:
              "Close view of checkout code with missing fallback path for unknown order type and test failure for a new kiosk order.",
            problem:
              "A new order type skips every known branch. Where should the fallback behavior live?",
          },
        ],
        title: "Checkout branch review",
      },
      topic: "Choosing Paths with If",
    },
  },
];
