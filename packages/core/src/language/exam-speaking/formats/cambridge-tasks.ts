import { type SpeakingTaskFormat, speakingTask } from "../speaking-format";

const INTERVIEW_BRIEF =
  "The examiner asks the candidate about themself: where they live, work or studies, free time, likes and plans.";

function interview(minutes: SpeakingTaskFormat["minutes"]): SpeakingTaskFormat {
  return speakingTask({
    brief: INTERVIEW_BRIEF,
    key: "p1",
    minutes,
    mode: "interaction",
    name: "Part 1: Interview",
    role: "examiner",
    stimulus: "topic",
  });
}

const LONG_TURN_OVER = {
  atSeconds: 60,
  say: 'The minute is up. When the candidate finishes their sentence, say "Thank you" and ask one short question about the photos, for an answer of about 30 seconds.',
};

const DECIDE = {
  atSeconds: 120,
  say: "Two minutes are up. As the other candidate, say you now have about a minute to decide, using the decision question on the card, and work toward a decision together.",
};

function collaborative(brief: string): SpeakingTaskFormat {
  return speakingTask({
    brief: `${brief} The two candidates may discuss the prompts in any order and needn't cover all of them; they aren't marked on reaching a decision.`,
    cues: [DECIDE],
    key: "p3",
    minutes: { max: 4, min: 3 },
    mode: "interaction",
    name: "Part 3: Collaborative task",
    role: "partner",
    stimulus: "topic",
  });
}

function discussion({
  brief,
  minutes,
}: {
  brief: string;
  minutes: SpeakingTaskFormat["minutes"];
}): SpeakingTaskFormat {
  return speakingTask({
    brief,
    continues: "p3",
    key: "p4",
    minutes,
    mode: "interaction",
    name: "Part 4: Discussion",
    role: "examiner",
    stimulus: "topic",
  });
}

const A2: SpeakingTaskFormat[] = [
  speakingTask({
    brief:
      'The examiner asks the candidate personal questions (name, where they live, work or study), then short questions on two everyday topics, each ending with one longer "Tell me something about…" question.',
    key: "p1",
    minutes: { max: 4, min: 3 },
    mode: "interaction",
    name: "Part 1: Interview",
    role: "examiner",
    stimulus: "topic",
  }),
  speakingTask({
    brief:
      'The candidates talk together about five pictures on one topic, answering a question such as "Do you like these different places to eat? Say why or why not."; then each says which they like best and answers a couple of follow-up questions on the topic.',
    cues: [
      {
        atSeconds: 150,
        say: "Now ask the candidate which of the things in the pictures they like best and why, then one or two more questions on the topic.",
      },
    ],
    key: "p2",
    minutes: { max: 6, min: 5 },
    mode: "interaction",
    name: "Part 2: Discussion",
    role: "partner",
    stimulus: "photos",
  }),
];

const B1: SpeakingTaskFormat[] = [
  interview({ max: 3, min: 2 }),
  speakingTask({
    brief:
      "The candidate describes one colour photograph of an everyday situation for about a minute: the people, the place, other things in it. The examiner only listens.",
    key: "p2",
    minutes: { max: 2, min: 1 },
    mode: "monologue",
    name: "Part 2: Extended turn",
    role: "examiner",
    stimulus: "photos",
  }),
  {
    ...collaborative(
      "The examiner reads a situation (such as a young man who works very hard and needs to relax); the candidates talk together about the options shown, make and respond to suggestions, and try to agree which would be best.",
    ),
    cues: [],
  },
  discussion({
    brief:
      "The examiner asks questions that broaden the Part 3 topic: the candidate's likes, habits and opinions.",
    minutes: { max: 3, min: 3 },
  }),
];

const B2: SpeakingTaskFormat[] = [
  interview({ max: 2, min: 2 }),
  speakingTask({
    brief:
      "The candidate compares two photographs and answers the question printed above them, speaking for a minute without interruption; then the examiner asks a short question about the photos.",
    cues: [LONG_TURN_OVER],
    key: "p2",
    minutes: { max: 2, min: 1 },
    mode: "monologue",
    name: "Part 2: Long turn",
    role: "examiner",
    stimulus: "photos",
  }),
  collaborative(
    'A discussion question with five written prompts around it (such as "Is it easy to eat healthily these days?"): two minutes of discussion, then a minute to decide on a second question.',
  ),
  discussion({
    brief:
      "The examiner asks evaluative questions on the Part 3 theme; the candidate gives and justifies opinions, which aren't judged as such.",
    minutes: { max: 4, min: 4 },
  }),
];

const C1: SpeakingTaskFormat[] = [
  interview({ max: 2, min: 2 }),
  speakingTask({
    brief:
      "The candidate picks two of three photographs and, for a minute without interruption, compares them and answers the two questions printed above them, speculating rather than just describing; then the examiner asks a short question about the photos.",
    cues: [LONG_TURN_OVER],
    key: "p2",
    minutes: { max: 2, min: 1 },
    mode: "monologue",
    name: "Part 2: Long turn",
    role: "examiner",
    stimulus: "photos",
  }),
  collaborative(
    "A central question with five written prompts: two minutes of discussion, then a minute to decide on a second question (such as which two are the least effective).",
  ),
  discussion({
    brief:
      "The examiner asks questions related to the Part 3 topic that invite the candidate to explore it more deeply and justify opinions.",
    minutes: { max: 5, min: 5 },
  }),
];

const C2: SpeakingTaskFormat[] = [
  interview({ max: 2, min: 2 }),
  speakingTask({
    brief:
      "First the candidates react for a minute to a question about two of the pictures, speculating rather than describing; then they do a decision-making task with all the pictures.",
    cues: [
      {
        atSeconds: 60,
        say: "The first minute is up. As the other candidate, move on to the decision task with all the pictures, using the second question on the card.",
      },
    ],
    key: "p2",
    minutes: { max: 4, min: 4 },
    mode: "interaction",
    name: "Part 2: Collaborative task",
    role: "partner",
    stimulus: "photos",
  }),
  speakingTask({
    brief:
      "A long turn of two minutes without interruption on a card with a question and three optional ideas; then the examiner asks a related question and leads a wider discussion on the theme.",
    cues: [
      {
        atSeconds: 120,
        say: "The two minutes are up. When the candidate finishes their sentence, thank them, ask one related question, then lead a wider discussion on the theme.",
      },
    ],
    key: "p3",
    minutes: { max: 7, min: 6 },
    mode: "monologueThenInteraction",
    name: "Part 3: Long turn and discussion",
    role: "examiner",
    stimulus: "topic",
  }),
];

/** In paired Cambridge parts, the AI takes the other candidate's role; long-turn timings are per candidate. */
export const CAMBRIDGE_TASKS = { A2, B1, B2, C1, C2 } as const;
