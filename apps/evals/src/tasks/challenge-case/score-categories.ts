import { defineScoreCategories } from "@/lib/score-categories";

export const CHALLENGE_CASE_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `A "work" case feels like a real day in a job where this course's field is used, at the right level: a fictional company with a real problem, realistic numbers, a deadline and pressure from colleagues. A "whatIf" case is a light, playful scenario where the chapter's big idea decides what happens, with no jargon or formulas. Notice a case that is a quiz in disguise, a meta task (planning a lesson, studying), or a job where the skills wouldn't really be used: the learner stops feeling they're practicing real work.`,
    id: "realism",
    label: "Real work (or a fun What if)",
    weight: 20,
  },
  {
    expectations: `Every decision matters: choices lead somewhere different (other replies, meters, endings), the strong choice isn't always the first, the longest or the most cautious one, weak choices are things a real person might do under pressure, and a balanced middle option is welcome. Meters use the job's own terms and move sensibly; time jumps bring new numbers when time passes. Notice when the right answer is obvious at every step or decisions change nothing: the learner clicks through without thinking.`,
    id: "decisions",
    label: "Decisions that matter",
    weight: 20,
  },
  {
    expectations: `1 to 4 colleagues by role with clearly different expertise who talk like colleagues (they push, disagree, want things). Asking a colleague or checking with the AI assistant is a real option in at least one decision and is valued when it's the smart move; the AI and colleagues give genuinely useful answers. Colleagues are never given names in the text (only {{id}} placeholders), and the learner is never named.`,
    id: "team",
    label: "Team and asking for help",
    weight: 15,
  },
  {
    expectations: `Debrief notes are specific to the decision, kind, and praise the strategy ("You checked whether the gap could be chance"), never talent or intelligence. Notes to improve say what to do instead, with a better wording as the example when it's about communicating. Each skill's practice line is something to do in about 5 minutes. The summary sentences each state one idea the case practiced. Generic notes ("Good job!") teach nothing, and judgmental ones sting.`,
    id: "debrief",
    label: "Debrief: specific and kind",
    weight: 20,
  },
  {
    expectations: `Every number, calculation and fact is correct and consistent across the panels, messages, time jumps and endings (for example, a p-value or a dose matches the numbers given). Health, law and money cases model safe, professional practice. A wrong fact the case teaches as right is something the learner carries into real work.`,
    id: "accuracy",
    label: "Accuracy",
    weight: 15,
  },
  {
    expectations: `Right depth for the level and variant: overview "whatIf" cases stay playful with 2 decisions per path and no jargon; beginner cases explain any term in the chat; intermediate and advanced cases use the profession's terms. Everything learner-facing is in the requested language with local number formats. No promises of a result, job or grade.`,
    id: "depth",
    label: "Depth, language and honesty",
    weight: 10,
  },
]);
