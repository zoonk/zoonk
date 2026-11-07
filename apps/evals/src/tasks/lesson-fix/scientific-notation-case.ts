import { type FixLessonDraftParams } from "@zoonk/ai/tasks/lesson-writer/fix";

export const RECORDED_SCIENTIFIC_NOTATION_FIX = {
  activityTemplates: [],
  chapterLessons: [
    { examples: [], ideas: [], order: "before", title: "Powers of ten" },
    {
      canDo: "Multiply and divide measurements written in scientific notation",
      examples: [
        "(2 × 10^-3) × (3 × 10^2) = 6 × 10^-1.",
        "(6 × 10^-3) ÷ (2 × 10^-5) = 3 × 10^2.",
        "A lab display must multiply 10^4 by 10^-2. Ask learners to guess what it should show: 10^2, 10^6, or 10^-8. Reveal 10^2 as soon as they pick; leave the reason for the next screen.",
        "Work through Mei's laser: each pulse uses 2 × 10^-3 J, and there are 3 × 10^2 pulses. Multiply the front numbers, 2 × 3 = 6, then add the powers, -3 + 2 = -1, to get 6 × 10^-1 J.",
        "A sample contains 2 × 10^3 pellets, each with a mass of 4 × 10^-2 g. Ask for their total mass: 8 × 10^1 g. Include 8 × 10^5 g as a tempting answer from subtracting instead of adding the powers.",
        "Work through a 6 × 10^-3 m crystal divided into lengths of 2 × 10^-5 m. Divide the front numbers, 6 ÷ 2 = 3, then subtract the powers, -3 - (-5) = 2: the crystal spans 3 × 10^2 of those lengths.",
      ],
      ideas: [
        "To multiply numbers in scientific notation, multiply the front numbers and add the powers of ten.",
        "To divide numbers in scientific notation, divide the front numbers and subtract the divisor’s power of ten.",
        "For an amount per group, find the total amount first, then divide by the number of groups.",
      ],
      order: "after",
      title: "Multiplying and dividing powers of ten",
    },
  ],
  chapterTitle: "Exponents and scientific notation",
  courseTitle: "Quantum physics from scratch",
  exams: [],
  language: "en",
  lesson: {
    screens: [
      {
        image: null,
        kind: "hookText",
        text: "A physics book lists the width of an atom as about 0.0000000001 m. That's nine zeros after the decimal point before you reach the 1. How could you write that number without all those zeros?",
        visual: null,
      },
      {
        exampleLineIdea:
          "a very large number from the learner's life, like their city's population or a national budget",
        explore: null,
        image: null,
        kind: "explanation",
        text: String.raw`You can write 4,200,000 as $4.2 \times 10^6$, because $10^6$ is 1,000,000. The front number must be at least 1 and less than 10. This is called **scientific notation**.`,
        title: "Big numbers, written short",
        visual: null,
      },
      {
        image: null,
        kind: "hookGuess",
        options: [
          { isCorrect: false, text: String.raw`The $7 \times 10^{-8}$ m scratch` },
          { isCorrect: true, text: String.raw`The $2 \times 10^{-7}$ m scratch` },
        ],
        question: String.raw`Two scratches on a microscope lens measure $7 \times 10^{-8}$ m and $2 \times 10^{-7}$ m long. Which scratch is longer?`,
        reveal: String.raw`The longer scratch is the one that measures $2 \times 10^{-7}$ m.`,
        visual: null,
      },
      {
        exampleLineIdea: null,
        explore: null,
        image: null,
        kind: "explanation",
        text: String.raw`$2 \times 10^{-7}$ m is 0.0000002 m. $7 \times 10^{-8}$ m is only 0.00000007 m. The power of ten decides first: −7 is bigger than −8, so $10^{-7}$ is bigger than $10^{-8}$.`,
        title: "Check the power first",
        visual: null,
      },
      {
        image: null,
        kind: "workedExample",
        problem: String.raw`Which is longer: $3.2 \times 10^0$ m or $3.8 \times 10^0$ m?`,
        result: String.raw`$3.8 \times 10^0$ m, which is 3.8 m, is the longer length.`,
        steps: [
          { math: "10^0 = 1", text: "Both lengths use the power $10^0$, which is 1." },
          { math: "3.8 > 3.2", text: "The powers match, so compare the front numbers." },
        ],
        title: "When the powers match",
        visual: null,
      },
      {
        basis: { quote: "The powers match, so compare the front numbers.", screen: 5 },
        context: String.raw`Two dust grains measure $4.12 \times 10^{-6}$ m and $4.9 \times 10^{-6}$ m across.`,
        image: null,
        kind: "check",
        options: [
          {
            isCorrect: true,
            picture: null,
            reason:
              "The powers match, so 4.9 and 4.12 decide. Think of 4.9 as 4.90, which is bigger than 4.12.",
            text: String.raw`The $4.9 \times 10^{-6}$ m grain`,
          },
          {
            isCorrect: false,
            picture: null,
            reason:
              "More digits don't make a number bigger. 4.12 is less than 4.90, so this grain is narrower.",
            text: String.raw`The $4.12 \times 10^{-6}$ m grain`,
          },
          {
            isCorrect: false,
            picture: null,
            reason:
              "Matching powers don't mean matching sizes. With the same power, the front numbers decide, and 4.9 is bigger.",
            text: "Both grains are the same width",
          },
        ],
        question: "Which grain is wider?",
        visual: null,
      },
      {
        image: null,
        kind: "workedExample",
        problem: "Write 58,000 m in scientific notation.",
        result: String.raw`58,000 m is $5.8 \times 10^4$ m.`,
        steps: [
          {
            math: String.raw`58{,}000 \to 5.8`,
            text: "Put the decimal point after the first digit.",
          },
          {
            math: String.raw`4 \text{ places}`,
            text: "Count the places the decimal point moved left.",
          },
          {
            math: String.raw`5.8 \times 10^4 = 58{,}000`,
            text: "Moving left shrank it, so a positive power grows it back.",
          },
        ],
        title: "Writing a big number",
        visual: null,
      },
      {
        basis: { quote: "Count the places the decimal point moved left.", screen: 7 },
        context: "A satellite circles about 7,200,000 m from the center of Earth.",
        image: null,
        kind: "check",
        options: [
          {
            isCorrect: true,
            picture: null,
            reason: "The decimal point moves 6 places left to land after the 7, so the power is 6.",
            text: String.raw`$7.2 \times 10^6$ m`,
          },
          {
            isCorrect: false,
            picture: null,
            reason:
              "That counts the 5 written zeros. The point also moves past the 2, so it moves 6 places.",
            text: String.raw`$7.2 \times 10^5$ m`,
          },
          {
            isCorrect: false,
            picture: null,
            reason:
              "7,200,000 has 7 digits, but the point only moves 6 places to land after the 7.",
            text: String.raw`$7.2 \times 10^7$ m`,
          },
          {
            isCorrect: false,
            picture: null,
            reason:
              "This equals 7,200,000, but 72 isn't less than 10. The front number must be at least 1 and less than 10.",
            text: String.raw`$72 \times 10^5$ m`,
          },
        ],
        question: "How do you write that distance in scientific notation?",
        visual: null,
      },
      {
        image: null,
        kind: "workedExample",
        problem: "Write 0.000406 m in scientific notation.",
        result: String.raw`0.000406 m is $4.06 \times 10^{-4}$ m.`,
        steps: [
          {
            math: String.raw`0.000406 \to 4.06`,
            text: "Put the point after the 4, keeping the zero inside.",
          },
          {
            math: String.raw`4 \text{ places}`,
            text: "Count the places the decimal point moved right.",
          },
          {
            math: String.raw`4.06 \times 10^{-4} = 0.000406`,
            text: "Moving right grew it, so a negative power shrinks it back.",
          },
        ],
        title: "Writing a tiny number",
        visual: null,
      },
      {
        basis: { quote: "Count the places the decimal point moved right.", screen: 9 },
        context: "A strand of hair measures 0.0000702 m across.",
        image: null,
        kind: "check",
        options: [
          {
            isCorrect: true,
            picture: null,
            reason:
              "The point moves 5 places right to land after the 7. A negative power shrinks 7.02 back to the tiny width.",
            text: String.raw`$7.02 \times 10^{-5}$ m`,
          },
          {
            isCorrect: false,
            picture: null,
            reason: "A positive power would make 702,000 m. A tiny number needs a negative power.",
            text: String.raw`$7.02 \times 10^{5}$ m`,
          },
          {
            isCorrect: false,
            picture: null,
            reason:
              "That counts the 4 zeros after the point. The point also has to move past the 7, so it moves 5 places.",
            text: String.raw`$7.02 \times 10^{-4}$ m`,
          },
          {
            isCorrect: false,
            picture: null,
            reason:
              "That drops the zero inside 702. The inside zero stays, so the front number is 7.02.",
            text: String.raw`$7.2 \times 10^{-5}$ m`,
          },
        ],
        question: "How do you write that width in scientific notation?",
        visual: null,
      },
      {
        basis: null,
        context:
          "You're writing a card for the Adler Planetarium in Chicago. It shows an atom's width, 0.0000000001 m, and Earth's average distance from the Sun, 149,600,000,000 m.",
        image: null,
        kind: "check",
        options: [
          {
            isCorrect: true,
            picture: null,
            reason:
              "From 149,600,000,000, the decimal point moves 11 places left to land after the 1.",
            text: String.raw`Earth–Sun distance: $1.496 \times 10^{11}$ m`,
          },
          {
            isCorrect: false,
            picture: null,
            reason:
              "That counts only the 8 zeros. The point also moves past the 4, 9 and 6, which makes 11 places.",
            text: String.raw`Earth–Sun distance: $1.496 \times 10^{8}$ m`,
          },
          {
            isCorrect: false,
            picture: null,
            reason: String.raw`The 1 comes after nine zeros, but the point moves 10 places to reach it. So the atom is $1 \times 10^{-10}$ m.`,
            text: String.raw`Atom width: $1 \times 10^{-9}$ m`,
          },
          {
            isCorrect: false,
            picture: null,
            reason: String.raw`The atom is $1 \times 10^{-10}$ m, and −11 is smaller than −10. So the particle is smaller, even with its bigger front number.`,
            text: String.raw`A particle $8 \times 10^{-11}$ m wide is bigger than the atom`,
          },
        ],
        question: "Which line belongs on the card?",
        visual: null,
      },
    ],
    summary: {
      ideas: [
        {
          label: "Scientific notation",
          text: "Scientific notation writes a number as a front number of at least 1 and less than 10, times a power of ten.",
        },
        {
          label: "Check the power first",
          text: "For positive numbers in scientific notation, the larger power of ten means the larger value, so compare the powers first.",
        },
        {
          label: "When the powers match",
          text: "When two numbers have the same power of ten, the bigger front number gives the bigger value.",
        },
        {
          label: "Count decimal moves",
          text: "The power counts the places the decimal point moves: moving left gives a positive power, and moving right gives a negative power.",
        },
      ],
      shape: "hub",
    },
  },
  level: "beginner",
  problems: [
    {
      problem:
        "Its problem, steps and result, shown together reads as 251 characters at once besides its tables; whatever a learner reads at one moment fits a tweet, at most 250. Keep one idea, move detail into a table, a visual or a worked step's math, and cut the rest.",
      screen: 8,
    },
    {
      problem:
        "Asks the question of screen 8 again with other numbers or names. Keep this screen's idea but ask something new about it: the reverse question, a harder case, a mistake to spot or a decision in a real situation.",
      screen: 9,
    },
  ],
  setup: false,
  shortAnswers: false,
  spec: {
    canDo: "Write measurements in scientific notation and compare their sizes",
    description:
      "Write very large and very small measurements compactly, then compare their sizes using powers of ten.",
    estimatedMinutes: 5,
    screens: [
      {
        activityTemplate: null,
        brief:
          "A physics reference lists an atom’s width as about 0.0000000001 m. How can you write that without a string of zeros?",
        kind: "hook",
        skills: [],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Scientific notation writes a positive number as a number from 1 up to—but not including—10, multiplied by a power of ten: 4,200,000 = 4.2 × 10^6.",
        kind: "explanation",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Which measurement will turn out to be longer: 7 × 10^-8 m or 2 × 10^-7 m? Offer those two options; reveal 2 × 10^-7 m as correct, countering the temptation to choose the larger front number.",
        kind: "guess",
        skills: [1],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "For positive numbers in scientific notation, a larger exponent means a larger value: −7 is greater than −8, so 2 × 10^-7 m is longer than 7 × 10^-8 m.",
        kind: "explanation",
        skills: [1],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Compare 3.2 × 10^0 m with 3.8 × 10^0 m: the powers match, so compare 3.2 with 3.8; the second length is greater. Reveal these short moves in order, recalling that 10^0 = 1.",
        kind: "workedExample",
        skills: [1],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Ask which is longer: 4.12 × 10^-6 m or 4.9 × 10^-6 m; the answer is 4.9 × 10^-6 m. Include the first as the tempting choice from treating more decimal digits as a larger value.",
        kind: "check",
        skills: [1],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Write 58,000 m in scientific notation: 58,000 → 5.8; move the decimal left 4 places; write 5.8 × 10^4 m. Reveal one move at a time, explaining that the positive power restores the larger original value.",
        kind: "workedExample",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Ask the learner to write 7,200,000 m in scientific notation; accept 7.2 × 10^6 m. Include 7.2 × 10^5 m as the tempting answer from counting written zeros instead of decimal moves.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Write 0.000406 m compactly: keep the internal zero to make 4.06; the decimal moved right 4 places; write 4.06 × 10^-4 m. Reveal one move at a time, explaining that the negative power restores the small original value.",
        kind: "workedExample",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "Ask the learner to write 0.0000702 m in scientific notation; accept 7.02 × 10^-5 m. Include 7.02 × 10^5 m for reversing the sign and 7.02 × 10^-4 m for counting leading zeros instead of moves.",
        kind: "check",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: null,
        brief:
          "For a reference card, rewrite an atom’s approximate width, 0.0000000001 m, and the mean Earth–Sun distance, 149,600,000,000 m; accept 1 × 10^-10 m and 1.496 × 10^11 m. Then ask whether an object 8 × 10^-11 m wide is smaller than the listed atom: yes, despite its larger front number.",
        kind: "application",
        skills: [0, 1],
        visual: null,
        visualKind: "none",
      },
    ],
    skills: [
      {
        description:
          "Express a positive measurement as a number from 1 up to 10, excluding 10, multiplied by a power of ten.",
        example: "0.000406 m = 4.06 × 10^-4 m.",
        hard: true,
        name: "Write a number in scientific notation",
        topic: "Scientific notation",
        useCase: "Record atomic sizes and astronomical distances without long strings of zeros.",
      },
      {
        description:
          "Compare positive numbers in scientific notation by their exponents first, then their front numbers when the exponents match.",
        example: "6 × 10^-9 m is smaller than 2 × 10^-8 m.",
        hard: true,
        name: "Compare numbers in scientific notation",
        topic: "Comparing scientific notation",
        useCase: "Decide which of two tiny or enormous physics measurements is larger.",
      },
    ],
    title: "Writing very big and very small numbers",
  },
} satisfies Omit<FixLessonDraftParams, "analytics" | "model" | "reasoning" | "useFallback">;
