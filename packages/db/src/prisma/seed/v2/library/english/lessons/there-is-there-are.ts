import { pt } from "../../../_utils/localize";
import { guess, option } from "../../content";
import { type SeedLesson } from "../../types";

/**
 * Unit "Renting an apartment", lesson 2. Portuguese "tem" covers both having and existing, so
 * Portuguese speakers say "Have two bedrooms". The lesson names that mistake and drills the fix.
 */
export const thereIsThereAreLesson: SeedLesson = {
  canDo: pt("Você vai descrever um apartamento com there is e there are."),
  description: pt(
    "Como descrever um lugar em inglês, sem o “have” que o português faz a gente usar.",
  ),
  key: "there-is-there-are",
  minutes: 7,
  sentences: [
    {
      distractors: ["have", "is"],
      explanation: pt(
        "Para dizer que algo existe num lugar, o inglês usa there is ou there are, e não have.",
      ),
      sentence: "There are two bedrooms.",
      translation: pt("Tem dois quartos."),
      translationDistractors: [pt("temos"), pt("salas")],
    },
    {
      distractors: ["have", "big"],
      explanation: pt(
        "There is + a + adjetivo + substantivo. O adjetivo vem antes do substantivo, ao contrário do português.",
      ),
      sentence: "There is a small balcony.",
      translation: pt("Tem uma varanda pequena."),
      translationDistractors: [pt("temos"), pt("grande")],
    },
  ],
  skills: ["there-is-are", "apartment-rooms"],
  steps: [
    {
      content: {
        options: [
          guess("have", pt("Have two bedrooms.")),
          guess("there", pt("There are two bedrooms."), true),
          guess("it", pt("It has two bedroom.")),
        ],
        question: pt("Como se diz “Tem dois quartos” ao descrever um apartamento?"),
        reveal: pt(
          "“There are two bedrooms.” Em português, “tem” faz dois papéis. Em inglês, para dizer que algo existe num lugar, é there is ou there are.",
        ),
        variant: "guess",
      },
      kind: "hook",
    },
    {
      content: {
        text: pt(
          "Quando “tem” quer dizer *existe*, o inglês usa **there is** para uma coisa e **there are** para várias:\n\n- *There is a balcony.* Tem uma varanda.\n- *There are two bedrooms.* Tem dois quartos.\n\n“Have” é para posse: *I have a car.* Eu tenho um carro.",
        ),
        title: pt("O “tem” que não é have"),
      },
      kind: "explanation",
      skill: "there-is-are",
    },
    { content: {}, kind: "vocabulary", skill: "apartment-rooms", word: "bedroom" },
    { content: {}, kind: "vocabulary", skill: "apartment-rooms", word: "bathroom" },
    {
      content: {
        options: [
          option(
            "is",
            pt("There is two bathrooms."),
            pt("Dois banheiros são mais de um, então é there are."),
          ),
          option(
            "are",
            pt("There are two bathrooms."),
            pt("Várias coisas existem no lugar: there are."),
            true,
          ),
          option(
            "have",
            pt("Have two bathrooms."),
            pt(
              "Esse é o “tem” traduzido palavra por palavra. Para dizer que algo existe, use there are.",
            ),
          ),
        ],
        question: pt("Qual frase descreve o apartamento corretamente?"),
      },
      kind: "check",
      skill: "there-is-are",
    },
    { content: {}, kind: "reading", sentence: "There is a small balcony.", skill: "there-is-are" },
    {
      content: {
        answers: ["are", "is"],
        distractors: ["have", "has"],
        feedback: pt("Dois quartos: are. Uma cozinha: is."),
        question: pt("Complete a descrição"),
        template: "There [BLANK] two bedrooms and there [BLANK] a small kitchen.",
      },
      kind: "fillBlank",
      skill: "there-is-are",
    },
    {
      content: {
        check: {
          explanation: pt("Living room é a sala de estar; a sala de jantar é dining room."),
          kind: "interaction",
        },
        fields: {
          distractors: [
            {
              side: "right",
              text: pt("sala de jantar"),
              why: pt("Living room é onde você senta e relaxa; sala de jantar é dining room."),
            },
          ],
          pairs: [
            { id: "bedroom", left: "bedroom", right: pt("quarto") },
            { id: "bathroom", left: "bathroom", right: pt("banheiro") },
            { id: "kitchen", left: "kitchen", right: pt("cozinha") },
            { id: "living", left: "living room", right: pt("sala de estar") },
            { id: "balcony", left: "balcony", right: pt("varanda") },
          ],
        },
        prompt: pt("Ligue cada cômodo ao nome em português."),
        template: "matchPairs",
      },
      kind: "activity",
      skill: "apartment-rooms",
    },
    { content: {}, kind: "reading", sentence: "There are two bedrooms.", skill: "there-is-are" },
    { content: {}, kind: "translation", skill: "apartment-rooms", word: "bathroom" },
    {
      content: {
        language: "en",
        prompt: pt("Fale em voz alta"),
        targetText: "There are two bedrooms and a small balcony.",
        translation: pt("Tem dois quartos e uma varanda pequena."),
      },
      kind: "spokenAnswer",
      skill: "there-is-are",
    },
    {
      content: {
        keyPoints: [
          pt("Usa there is para uma coisa só"),
          pt("Usa there are para mais de uma"),
          pt("Não usa have para dizer que algo existe no lugar"),
        ],
        question: pt(
          "Em uma ou duas frases em inglês, descreva o lugar onde você mora, ou um que gostaria de alugar, usando there is e there are.",
        ),
        sampleAnswer: pt(
          "There are two bedrooms and there is a big kitchen. There is no balcony, but there is a small garden.",
        ),
      },
      kind: "typedAnswer",
      skill: "there-is-are",
    },
    {
      content: {
        ideas: [
          { text: pt("There is para uma coisa, there are para várias.") },
          { text: pt("Have é para posse; there is/are é para existir.") },
          { text: pt("O adjetivo vem antes do substantivo: a small balcony.") },
        ],
      },
      kind: "summary",
    },
  ],
  title: pt("There is, there are"),
  words: [
    { distractors: ["bathroom", "kitchen"], translation: pt("quarto"), word: "bedroom" },
    {
      distractors: ["bedroom"],
      note: pt(
        "Nos Estados Unidos, bathroom é o banheiro de casa; o banheiro público costuma ser restroom.",
      ),
      translation: pt("banheiro"),
      word: "bathroom",
    },
  ],
};
