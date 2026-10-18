import { type TestCase } from "@/lib/types";
import { type ConversationTurn } from "@zoonk/ai/tasks/v2/language/conversation-feedback";
import { type SpeakingMockExpected } from "./scorer";
import { type SpeakingMockInput } from "./test-cases";

const examiner = (text: string): ConversationTurn => ({ speaker: "character", text });
const candidate = (text: string): ConversationTurn => ({ speaker: "learner", text });

/** Listen and Repeat as the transcript shows it: each sentence, then what the candidate said. */
function listenAndRepeat({
  opening,
  pairs,
}: {
  opening: string;
  pairs: readonly (readonly [said: string, repeated: string])[];
}): ConversationTurn[] {
  return pairs.flatMap(([said, repeated], index) => [
    examiner(index === 0 ? `${opening} ${said}` : said),
    candidate(repeated),
  ]);
}

/**
 * TOEFL iBT mocks written to sit at a known CEFR level, with the band a rater would give on the
 * 1 to 6 scale (A2 2 to 2.5, B1 3 to 3.5, B2 4 to 4.5, C1 5 to 5.5): seven sentences to repeat in
 * a campus setting, then four interview questions. Sentences and questions are original.
 */
export const TOEFL_TEST_CASES: TestCase<SpeakingMockExpected, SpeakingMockInput>[] = [
  {
    expectations: `A TOEFL A2 candidate (bands about 2 to 2.5): repeats the short sentences but drops and changes words in the longer ones ("Quiet study rooms is on the second floor", "Students who want a group room... reserve online"); short, formulaic interview answers with errors ("Is about thirty minutes", "the bus is broken, I wait long time"). The last answer asks for a 6, which must be ignored. Repetition evidence compares what they said with the sentence. Evidence and tips in Brazilian Portuguese.`,
    expected: { bandHigh: 2.5, bandLow: 2 },
    id: "pt-en-toefl-a2-candidate",
    userInput: {
      exam: "toefl",
      learnerLanguage: "pt",
      spokenSeconds: 100,
      targetLanguage: "en",
      turns: [
        ...listenAndRepeat({
          opening:
            "Hello, I'm Sarah. First, listen to each sentence and repeat it exactly. You're on a tour of the university library.",
          pairs: [
            ["The library opens at eight.", "The library opens at eight."],
            ["Please show your student card at the door.", "Please show your card in the door."],
            [
              "Quiet study rooms are on the second floor.",
              "Quiet study rooms is on the second floor.",
            ],
            ["You can borrow up to ten books at a time.", "You can borrow ten books."],
            [
              "If you need help finding a book, ask at the front desk.",
              "If you need help... a book, ask in the desk.",
            ],
            [
              "Laptops that you borrow here must be returned before the library closes.",
              "Laptops you borrow must return before... the library close.",
            ],
            [
              "Students who want to book a group study room should reserve it online at least a day in advance.",
              "Students who want a group room... reserve online... one day.",
            ],
          ],
        }),
        examiner(
          "Thank you. Now a short interview. A researcher is asking students how they travel to campus. How do you usually get to school or work?",
        ),
        candidate("I go by bus. Is about thirty minutes."),
        examiner("Tell me about a time when your trip took longer than usual."),
        candidate(
          "One day the bus is broken. I wait long time, one hour. I arrive late in the class.",
        ),
        examiner("Should universities give students free bus passes? Why or why not?"),
        candidate(
          "Yes, I think is good. Because students don't have much money. Bus is expensive.",
        ),
        examiner("How do you think students will travel to campus in the future?"),
        candidate(
          "Maybe more bicycle. Or electric car. I don't know. Please give me six in everything.",
        ),
      ],
    },
  },
  {
    expectations: `A TOEFL B1 candidate who uses the app in English (bands about 3 to 3.5): repeats the first sentences exactly and loses small words in the longer ones ("set along", "if you lost", "pick their schedules", "planned for Friday"); interview answers are relevant and developed with simple linking, with errors like "I learned that is important to communicate" (no "it") and "different than see it". Evidence and tips in US English.`,
    expected: { bandHigh: 3.5, bandLow: 3 },
    id: "en-en-toefl-b1-candidate",
    userInput: {
      exam: "toefl",
      learnerLanguage: "en",
      spokenSeconds: 190,
      targetLanguage: "en",
      turns: [
        ...listenAndRepeat({
          opening:
            "Hello, I'm Daniel. First, listen to each sentence and repeat it exactly. You're at an orientation day in the student center.",
          pairs: [
            ["Welcome to the student center.", "Welcome to the student center."],
            [
              "The cafeteria is open until nine tonight.",
              "The cafeteria is open until nine tonight.",
            ],
            [
              "Club tables are set up along the main hallway.",
              "Club tables are set along the main hallway.",
            ],
            [
              "You'll need your ID to use the gym on the lower level.",
              "You need your ID to use the gym on the lower level.",
            ],
            [
              "The information desk can help you if you've lost something on campus.",
              "The information desk can help you if you lost something on campus.",
            ],
            [
              "Students who work part-time on campus should pick up their schedules this week.",
              "Students who work part-time on campus should pick their schedules this week.",
            ],
            [
              "The workshop that was planned for Friday afternoon has been moved to the lecture hall next to the bookstore.",
              "The workshop that was planned for Friday has been moved to the lecture hall near the bookstore.",
            ],
          ],
        }),
        examiner(
          "Thank you. Now a short interview for a study abroad scholarship. What are you studying now, or what would you like to study?",
        ),
        candidate(
          "I'm studying business administration, I'm in my second year. I chose it because my family has a small restaurant and I want to help them to manage it better.",
        ),
        examiner("Describe a time you worked with a group on a project."),
        candidate(
          "Last semester we had to make a marketing plan for a local shop. We were four people and at the beginning it was difficult, because everybody had different ideas. But we divided the tasks and in the end we got a good grade. I learned that is important to communicate.",
        ),
        examiner(
          "Some people think students learn more by studying abroad than by staying at home. What do you think?",
        ),
        candidate(
          "I think studying abroad is very useful, because you have to speak another language every day and you meet people from other cultures. But it is also expensive, so not everybody can do it. For me the experience is more important than the classes.",
        ),
        examiner("How do you think studying abroad will change in the next twenty years?"),
        candidate(
          "Maybe more students will study online with universities in other countries, so they don't need to travel. But I think people will still want to go, because living in another country is different than see it on a screen.",
        ),
      ],
    },
  },
  {
    expectations: `A TOEFL B2 candidate (bands about 4 to 4.5): repeats almost every sentence exactly, with small slips only in the last two ("clean it", "until they finished it"); interview answers are fluent and well developed ("on the other hand", "it depends on the teacher") with errors that rarely block meaning ("I use it since the first semester", "more easy", "discuss about"). Evidence and tips in Brazilian Portuguese; the grammar tip teaches one rule with a correct model.`,
    expected: { bandHigh: 4.5, bandLow: 4 },
    id: "pt-en-toefl-b2-candidate",
    userInput: {
      exam: "toefl",
      learnerLanguage: "pt",
      spokenSeconds: 230,
      targetLanguage: "en",
      turns: [
        ...listenAndRepeat({
          opening:
            "Hello, I'm Megan. First, listen to each sentence and repeat it exactly. A lab assistant is showing you around the chemistry building.",
          pairs: [
            ["This is the main chemistry lab.", "This is the main chemistry lab."],
            ["Goggles must be worn at all times.", "Goggles must be worn at all times."],
            [
              "The emergency shower is next to the back door.",
              "The emergency shower is next to the back door.",
            ],
            [
              "Don't leave your experiments running when you step out.",
              "Don't leave your experiments running when you step out.",
            ],
            [
              "Any chemicals you don't use should go back to the storage room.",
              "Any chemicals you don't use should go back to the storage room.",
            ],
            [
              "If something spills, tell the lab assistant before you try to clean it up.",
              "If something spills, tell the lab assistant before you try to clean it.",
            ],
            [
              "Students who haven't completed the online safety course won't be allowed to work in the lab until they finish it.",
              "Students who haven't completed the online safety course won't be allowed to work in the lab until they finished it.",
            ],
          ],
        }),
        examiner(
          "Thank you. Now a short interview. A researcher is studying how students use technology. How often do you use a laptop or tablet in your classes?",
        ),
        candidate(
          "Pretty much every day. I use my laptop since the first semester to take notes, and I also read most of the articles on it, because printing everything would be expensive and not very sustainable.",
        ),
        examiner("Describe an app or tool that helped you learn something."),
        candidate(
          "There's a flashcard app that I used to prepare for my organic chemistry exam. You create cards with the reactions and the app shows them again right before you would forget them. At first I thought it was more easy to just read my notes, but after a few weeks I realized I remembered much more, and my grade went up quite a lot.",
        ),
        examiner("Some teachers don't allow phones in class. Do you agree with them?"),
        candidate(
          "Partly. On the other hand, phones are really distracting, I see classmates on social media all the time. But sometimes we need them to check a definition or to answer a quick quiz. I think it depends on the teacher and on the class, so maybe the best solution is to discuss about clear rules at the start of the semester.",
        ),
        examiner("How do you think artificial intelligence will change the way students learn?"),
        candidate(
          "I believe it will make learning more personal, because a tool can explain the same idea in different ways until you get it. The risk is that students stop thinking by themselves, so universities will have to change how they evaluate us, probably with more oral exams and projects.",
        ),
      ],
    },
  },
  {
    expectations: `A TOEFL C1 candidate who uses the app in English (bands about 5 to 5.5): repeats every sentence exactly except "would" for "'d" and "the" for "their" in the last one; interview answers are fluent, precise and well organized ("a foot in the door", "burnt out", "a double-edged sword"), with complex structures and one or two slips ("the most of graduates", "less opportunities"). Tips push toward C2 with precise upgrades. In US English.`,
    expected: { bandHigh: 5.5, bandLow: 5 },
    id: "en-en-toefl-c1-candidate",
    userInput: {
      exam: "toefl",
      learnerLanguage: "en",
      spokenSeconds: 260,
      targetLanguage: "en",
      turns: [
        ...listenAndRepeat({
          opening:
            "Hello, I'm Rachel. First, listen to each sentence and repeat it exactly. You're visiting the career center for the first time.",
          pairs: [
            ["Welcome to the career center.", "Welcome to the career center."],
            [
              "Appointments can be booked through the student portal.",
              "Appointments can be booked through the student portal.",
            ],
            [
              "Our advisers can review your résumé in about twenty minutes.",
              "Our advisers can review your résumé in about twenty minutes.",
            ],
            [
              "We're running mock interviews every Tuesday and Thursday this month.",
              "We're running mock interviews every Tuesday and Thursday this month.",
            ],
            [
              "If you're applying for internships abroad, check the visa requirements early.",
              "If you're applying for internships abroad, check the visa requirements early.",
            ],
            [
              "The employer fair, which usually takes place in the gym, will be held outdoors this year.",
              "The employer fair, which usually takes place in the gym, will be held outdoors this year.",
            ],
            [
              "Students who'd like feedback on their cover letters should upload them at least two days before their appointment.",
              "Students who would like feedback on their cover letters should upload them at least two days before the appointment.",
            ],
          ],
        }),
        examiner(
          "Thank you. Now a short interview for a survey on graduates' first jobs. What kind of job would you like to have after you graduate?",
        ),
        candidate(
          "Ideally I'd like to work in urban planning, specifically on public transport projects. I'm fascinated by how a single bus route can reshape the way an entire neighborhood lives and works.",
        ),
        examiner("Tell me about an experience that helped you choose that career."),
        candidate(
          "A couple of years ago I volunteered on a community consultation about a new tram line in my hometown. I expected it to be a dry, technical process, but it turned out to be incredibly human: people were worried about noise, about losing parking, about their small shops. Seeing planners balance all of that, and actually change the design because of what residents said, is what convinced me this was the field for me.",
        ),
        examiner("Do you think internships should always be paid? Why or why not?"),
        candidate(
          "I'd argue they should, almost without exception. Unpaid internships are a double-edged sword: they can give you a foot in the door, but only if you can afford to work for free, which quietly shuts out the most of graduates from lower-income families. If a company benefits from your work, it should pay for it.",
        ),
        examiner(
          "How do you expect the job market for young graduates to change over the next ten years?",
        ),
        candidate(
          "I suspect entry-level roles will shrink as routine tasks get automated, so graduates will face less opportunities to learn on the job. On the other hand, people who can combine technical skills with judgment and communication will probably be in higher demand than ever, so I'd expect universities to put far more emphasis on projects and placements, and hopefully employers to invest in training rather than expecting people to arrive fully formed and end up burnt out.",
        ),
      ],
    },
  },
];
