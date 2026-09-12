import { type Task } from "@/lib/types";
import { generateCourseDiscovery } from "@zoonk/ai/tasks/courses/discovery";

type Input = Parameters<typeof generateCourseDiscovery>[0];
export const courseDiscoveryTask: Task<
  Input,
  Awaited<ReturnType<typeof generateCourseDiscovery>>["data"]
> = {
  description: "Ask only useful contextual follow-ups and resolve a complete learning brief",
  generate: generateCourseDiscovery,
  id: "course-discovery",
  name: "Course Discovery",
  testCases: [
    {
      expectations:
        "Ask one useful question whose answer changes the plan, such as the damage, available tools or existing skill. Provide low-effort distinct options; do not ask a long questionnaire at once or prematurely assume equipment.",
      id: "specific-tools-needed",
      userInput: {
        answers: [],
        language: "en",
        prompt: "Teach me to repair a fictional wooden game box",
      },
    },
    {
      expectations:
        "The outcome, prior knowledge and constraints are sufficiently clear. Return ready with a concise complete brief, preserving five minutes, no slides, knowing the rules and letting people try. Avoid asking redundant time, knowledge or outcome questions.",
      id: "ready-fictional-game",
      userInput: {
        answers: [
          {
            answer:
              "Explain a token-collection game in five minutes with no slides, then let people try. I know all the rules but have never taught it.",
            question: "What do you need to do?",
            questionId: "outcome",
          },
        ],
        language: "en",
        prompt: "Teach a simple invented game to a fictional group",
      },
    },
    {
      expectations:
        "Return ready with format personalized and null reusableCoursePrompt. A selected shared path cannot customize operational backup instructions for this particular equipment and connectivity. The fictional learner's goal, environment and starting knowledge already support useful teaching. Protect originals and the Lightroom catalog as a sensible course-design default; do not ask the novice to choose backup scope or other expert implementation details. Begin with simple local backups, disconnected drives and restoration verification; address offsite options later. Preserve constraints and distinguish assumptions from learner-provided facts. Do not add another optional interface, scheduling or OS-version question.",
      id: "ready-backup-expert-defaults",
      userInput: {
        answers: [
          {
            answer: "Lightroom Classic",
            question: "Which Lightroom do you use?",
            questionId: "lightroom-edition",
          },
          {
            answer: "Local backups now, offsite later",
            question: "Where should backups live?",
            questionId: "backup-location",
          },
          {
            answer: "I connect the SSDs as needed",
            question: "How are your external drives connected?",
            questionId: "drive-connection",
          },
        ],
        language: "en",
        prompt:
          "Fictional QA learner: a photographer wants reliable photo backups on a Mac with two external SSDs and unreliable internet. They know Lightroom but have no automation experience.",
      },
    },
    {
      expectations:
        "There is no arbitrary question limit. If outcome, tools or experience still materially affect the plan, ask one relevant unanswered question. Do not stop solely because twelve answers already exist and do not repeat an answered question.",
      id: "more-than-ten-answers",
      userInput: {
        answers: Array.from({ length: 12 }, (_, index) => ({
          answer: "Use only the supplied fictional material and preserve the requested design",
          question: `Material requirement ${index + 1}`,
          questionId: `material-${index}`,
        })),
        language: "en",
        prompt: "A fictional complex craft project with specific tool constraints",
      },
    },
  ],
};
