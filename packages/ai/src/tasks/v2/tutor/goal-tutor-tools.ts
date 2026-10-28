/**
 * The one list: the tool, core, the API and the conversation each handle every feature by type, so
 * a feature added here is added everywhere. It stays in the cached start of every request.
 */
export const GOAL_TUTOR_APP_TOOLS = [
  "startGoal",
  "chapterTest",
  "chooseFocus",
  "mockExam",
  "essay",
  "mistakes",
  "conversationCall",
  "pronunciation",
  "stats",
  "logbook",
  "memory",
  "plus",
] as const;

export type GoalTutorAppTool = (typeof GOAL_TUTOR_APP_TOOLS)[number];

const APP_TOOL_USES: Record<GoalTutorAppTool, string> = {
  chapterTest:
    "a short test on the next chapter (of `area`, when they name a subject); passing it skips the lessons it covers. For lessons that feel too easy or a chapter they say they know.",
  chooseFocus:
    "choosing which subjects get the plan's depth, with a short test that chooses for them. When their time doesn't cover everything in depth and they want to decide, or don't know, where to focus.",
  conversationCall:
    "a short spoken practice call with a character from their current unit, in the language they're learning. When they want to practise speaking, a conversation or an interview.",
  essay:
    "the page of their exam's written test (an essay, such as the redação): when their plan practices it, each draft graded with the exam's criteria, and changing when. When they want to practise or improve their essay.",
  logbook:
    "their week in review: what they did this week next to the last, their biggest step forward and what comes next. When they ask what they did or achieved this week.",
  memory:
    "what the app remembers about them, to see, correct or delete, and the switch that turns memory off. When they ask what you know or remember about them, or want something forgotten or corrected.",
  mistakes:
    "their mistakes notebook: every question they got wrong, why, and practice that brings each one back. When they want to go over what they got wrong or keep making the same mistakes.",
  mockExam:
    "a mock exam of their exam, timed like the real one, to take now: the full exam, half of it or one subject, with results by subject. When they want a mock (a \"simulado\"), timed practice in the exam's format or to see how they'd do on the whole exam.",
  plus: "Plus, the app's paid plan: what it includes and subscribing or managing it. When they ask about Plus, its price, subscribing or cancelling.",
  pronunciation:
    "the words they mispronounced in the language they're learning, to say again with a native recording and a tip. When they want to work on their pronunciation.",
  startGoal:
    'starting a new goal, for anything this goal doesn\'t cover: another subject, skill, language or exam, or a quick explanation of a topic outside it. Give `goal`, what they want in their own words, as they\'d type it to start it ("Aprender violão para tocar na igreja"), and `topic`, its subject in one to three words as a course would be titled ("Violão"). The card starts the goal with their words filled in, and shows a ready course from the app\'s catalog when one matches.',
  stats:
    "their statistics: Energy, level, how many answers they get right, when they study best and the days they studied. When they ask how they're doing in numbers, or about their Energy or level.",
};

export const GOAL_TUTOR_APP_TOOLS_DESCRIPTION = [
  "Shows one of the app's own features as a card under your answer, with the button that opens it. Offer one whenever it answers what the learner wants, before anything outside the app.",
  ...GOAL_TUTOR_APP_TOOLS.map((tool) => `- ${tool}: ${APP_TOOL_USES[tool]}`),
].join("\n");
