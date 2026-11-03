import { defineScoreCategories } from "@/lib/score-categories";

export const CONVERSATION_SCENARIO_SCORE_CATEGORIES = defineScoreCategories([
  {
    expectations: `The call is a real moment from the unit that a person would handle by talking to someone, uses only what the unit covers, and is everyday and safe. The character fits the place: a common first name where the target variant is spoken, a plausible role, a short place name, and prices or times realistic for that country. The character fits the moment. A service unit (renting, a clinic, a shop, a counter) casts a stranger who works there and meets the learner for the first time. A social unit (making plans, the week or weekend, family, hobbies, catching up) casts someone who already knows the learner: a friend, colleague, neighbor or host family member, never a relative and never someone new, such as a new neighbor met for the first time. Judge the relationship from the role, the situation and the opening line together, in any language: the situation says who they are to the learner, and the opening line sounds like someone who knows them rather than a clerk ("How can I help?"). Every learner of the unit gets the same scenario, so nothing names the learner or assumes facts about their life (their job, family, city or plans) beyond the situation's premise. With someone who knows the learner, the place and situation name no city or neighborhood, since that would be where the learner lives; a street, a café or the building is fine. Score at most 5 for a scenario outside the unit; at most 6 when the character's relationship doesn't fit the moment (a stranger in a social unit, someone who knows the learner in a service unit) or when the scenario names the learner or assumes facts about their life, their city included.`,
    id: "unitFit",
    label: "Fits the unit and real life",
    weight: 25,
  },
  {
    expectations: `The opening line and hints use words and structures a learner at the given level knows: at A1 and A2 short sentences with the most common words, longer and richer from B1 up. The opening line greets, names who the character is as the one speaking ("this is Sarah", "it's Jake", "田中です", "Sie sprechen mit Anna") or names the place, and invites the learner to talk without answering any objective. It addresses no one by name: "Hi, Emma" or "Hi Emma!" when Emma is the character greets the character itself, and the character can't know the learner's name. Hints are complete sentences the learner could say as they are, covering the objectives. Score at most 6 when the opening line or most hints are clearly above the level, when the opening line names neither the character nor the place, or when it addresses anyone by name.`,
    id: "level",
    label: "At the learner's level",
    weight: 20,
  },
  {
    expectations: `2 to 4 objectives, in the order they'd happen, that a learner can reach in 1 to 3 minutes of talk, each checkable from what the learner says (never a feeling or attitude). Labels are 2 to 5 words starting with a verb and descriptions say what to say or find out, never the answer: no value the character's brief holds (a price, a day or time it offers), no choice the learner should make for themselves (which day, what to do) and no hint of the twist. Score at most 6 when an objective can't be checked from speech or a description gives away an answer, a choice or the twist.`,
    id: "objectives",
    label: "Objectives",
    weight: 25,
  },
  {
    expectations: `The character brief is in English and gives the voice model what it needs: personality, every fact the learner may ask about with concrete values, one small twist kept simple at A1 and A2, how to wrap up, and the instruction to speak at the level. The character doesn't do the learner's goals for them. Score at most 5 when facts the objectives need are missing.`,
    id: "brief",
    label: "Character brief",
    weight: 15,
  },
  {
    expectations: `Title, situation, role and objective descriptions are in the learner's language, natural and concise; place, opening line, objective labels and hints are in the target language and its variant (US English, Brazilian Portuguese, Mexican Spanish); the brief is in English. No emojis and no em dashes. Score at most 5 for a field in the wrong language.`,
    id: "languages",
    label: "Right language per field",
    weight: 15,
  },
]);
