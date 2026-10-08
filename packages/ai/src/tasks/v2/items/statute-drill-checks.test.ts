import { describe, expect, it } from "vitest";
import { checkStatuteDrills } from "./statute-drill-checks";
import { type StatuteDrill } from "./statute-drills";

const CAPUT = "Art. 5º, caput";
const ITEM_II = "Art. 5º, II";

const articles = [
  {
    reference: CAPUT,
    text: "Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade, nos termos seguintes:",
  },
  {
    reference: ITEM_II,
    text: "II - ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei;",
  },
  {
    reference: "Art. 5º, IV",
    text: "IV - é livre a manifestação do pensamento, sendo vedado o anonimato;",
  },
];

function statement(text: string, isTrue: boolean, reference = CAPUT): StatuteDrill {
  return {
    context: null,
    difficulty: "medium",
    format: "trueFalse",
    image: null,
    isTrue,
    misconception: isTrue ? null : "Troca uma palavra do texto",
    reason: "O texto diz outra coisa.",
    reference,
    statement: text,
    visual: null,
  };
}

function gap(question: string, acceptedAnswers: string[], reference = CAPUT): StatuteDrill {
  return {
    acceptedAnswers,
    context: null,
    difficulty: "easy",
    format: "typed",
    image: null,
    keyPoints: ["Quem é igual perante a lei"],
    question,
    reference,
    sampleAnswer: question.replace("____", acceptedAnswers[0] ?? ""),
    visual: null,
  };
}

const multipleChoice: StatuteDrill = {
  context: null,
  difficulty: "medium",
  format: "multipleChoice",
  image: null,
  options: [
    { isCorrect: true, misconception: null, reason: "É o texto.", text: "vedado o anonimato" },
    { isCorrect: false, misconception: "Inverte", reason: "Não.", text: "permitido o anonimato" },
    { isCorrect: false, misconception: "Troca", reason: "Não.", text: "exigida a identidade" },
    { isCorrect: false, misconception: "Troca", reason: "Não.", text: "livre o anonimato" },
  ],
  question: "De acordo com a CF/88, na manifestação do pensamento, é",
  reference: "Art. 5º, IV",
  visual: null,
};

const TRUE_CAPUT =
  "Segundo a CF/88, todos são iguais perante a lei, sem distinção de qualquer natureza.";

const FALSE_CAPUT = "Segundo a CF/88, quase todos são iguais perante a lei.";
const TRUE_II = "Ninguém será obrigado a fazer alguma coisa senão em virtude de lei.";
const FALSE_II = "Ninguém será obrigado a fazer alguma coisa, ainda que em virtude de lei.";

describe(checkStatuteDrills, () => {
  it("keeps drills that follow their articles", () => {
    const drills = [
      statement(TRUE_CAPUT, true),
      statement(FALSE_CAPUT, false),
      gap("Todos são iguais perante a lei, sem ____ de qualquer natureza", ["distinção"]),
      multipleChoice,
    ];

    expect(checkStatuteDrills({ articles, drills })).toStrictEqual({ drills, dropped: [] });
  });

  it("drops drills citing an article that wasn't given", () => {
    const drill = statement(TRUE_CAPUT, true, "Art. 6º");
    const result = checkStatuteDrills({ articles, drills: [drill, statement(FALSE_CAPUT, false)] });

    expect(result.dropped).toStrictEqual([
      { drill, problems: ['Cites "Art. 6º", which isn\'t one of the articles.'] },
    ]);
  });

  it("spells each reference as the caller gave it", () => {
    const drills = [
      statement(TRUE_CAPUT, true, " art. 5º,  CAPUT"),
      statement(FALSE_II, false, ITEM_II),
    ];

    const result = checkStatuteDrills({ articles, drills });

    expect(result.drills.map((drill) => drill.reference)).toStrictEqual([CAPUT, ITEM_II]);
  });

  it("drops a gap whose answer doesn't rebuild the article's passage", () => {
    const wrongWord = gap("Todos são iguais perante a lei, sem ____ de qualquer natureza", [
      "exceção",
    ]);

    const paraphrased = gap("Todos são ____ diante da lei", ["iguais"]);
    const result = checkStatuteDrills({ articles, drills: [wrongWord, paraphrased] });
    const problem = "Filled with its first accepted answer, the passage doesn't match the article.";

    expect(result.drills).toStrictEqual([]);
    expect(result.dropped.map((entry) => entry.problems)).toStrictEqual([[problem], [problem]]);
  });

  it("ignores case, accents, spacing and punctuation when rebuilding a passage", () => {
    const drill = gap("“TODOS SAO IGUAIS   perante a lei, sem ____ de qualquer natureza”", [
      "DISTINCAO",
    ]);

    expect(checkStatuteDrills({ articles, drills: [drill] }).drills).toStrictEqual([drill]);
  });

  it("requires exactly one gap and an accepted answer", () => {
    const noGap = gap("Todos são iguais perante a lei", ["todos"]);
    const twoGaps = gap("____ são iguais perante a ____", ["Todos"]);
    const noAnswer = gap("Todos são iguais perante a ____", [" "]);
    const result = checkStatuteDrills({ articles, drills: [noGap, twoGaps, noAnswer] });

    expect(result.dropped.map((entry) => entry.problems)).toStrictEqual([
      ["Has 0 gaps instead of 1."],
      ["Has 2 gaps instead of 1."],
      ["Has no accepted answer for its gap."],
    ]);
  });

  it("accepts any gap of three or more underscores", () => {
    const drill = gap("Todos são iguais perante a ______, sem distinção", ["lei"]);

    expect(checkStatuteDrills({ articles, drills: [drill] }).drills).toStrictEqual([drill]);
  });

  it("drops a false statement that is the article's own text", () => {
    const copied = statement("todos são iguais perante a lei", false);

    const result = checkStatuteDrills({
      articles,
      drills: [statement(TRUE_II, true, ITEM_II), copied],
    });

    expect(result.dropped).toStrictEqual([
      { drill: copied, problems: ["A false statement repeats its article word for word."] },
    ]);
  });

  it("drops a true statement that adds or drops a negation", () => {
    const added = statement(
      "É livre a manifestação do pensamento, não sendo vedado o anonimato.",
      true,
      "Art. 5º, IV",
    );

    const contraction = statement(
      "Os brasileiros e os estrangeiros residentes no País são iguais.",
      true,
    );

    const negatedArticle = {
      reference: "Lei X, art. 1º",
      text: "O servidor não será removido de ofício sem motivação expressa.",
    };

    const droppedNegation = statement(
      "O servidor será removido de ofício sem motivação expressa.",
      true,
      "Lei X, art. 1º",
    );

    const result = checkStatuteDrills({
      articles: [...articles, negatedArticle],
      drills: [added, contraction, droppedNegation, statement(FALSE_II, false, ITEM_II)],
    });

    expect(result.drills).toStrictEqual([contraction, statement(FALSE_II, false, ITEM_II)]);

    expect(result.dropped.map((entry) => entry.problems)).toStrictEqual([
      ["A true statement adds or drops a negation from its article."],
      ["A true statement adds or drops a negation from its article."],
    ]);
  });

  it("keeps a true statement whose negation is the article's own", () => {
    const negatedArticle = {
      reference: "Lei X, art. 1º",
      text: "O servidor não será removido de ofício sem motivação expressa.",
    };

    const faithful = statement(
      "Segundo a Lei X, o servidor não será removido de ofício sem motivação expressa.",
      true,
      "Lei X, art. 1º",
    );

    const result = checkStatuteDrills({
      articles: [negatedArticle],
      drills: [faithful, statement("O servidor será removido de ofício.", false, "Lei X, art. 1º")],
    });

    expect(result.dropped).toStrictEqual([]);
  });

  it("drops a statement or passage that repeats an earlier one", () => {
    const first = statement(TRUE_CAPUT, true);
    const repeated = statement(`  ${TRUE_CAPUT.toUpperCase()} `, true);

    const result = checkStatuteDrills({
      articles,
      drills: [first, statement(FALSE_II, false, ITEM_II), repeated],
    });

    expect(result.dropped).toStrictEqual([
      { drill: repeated, problems: ["Repeats an earlier drill."] },
    ]);
  });

  it("lets multiple-choice drills share a command", () => {
    const other = { ...multipleChoice, options: multipleChoice.options.toReversed() };

    expect(checkStatuteDrills({ articles, drills: [multipleChoice, other] }).dropped).toStrictEqual(
      [],
    );
  });

  it("drops surplus statements when one answer dominates", () => {
    const trues = [
      TRUE_CAPUT,
      TRUE_II,
      "Todos são iguais perante a lei.",
      "Não há distinção de qualquer natureza entre os iguais perante a lei.",
    ].map((text, index) => statement(text, true, index === 1 ? ITEM_II : CAPUT));

    const oneFalse = statement(FALSE_CAPUT, false);

    const result = checkStatuteDrills({
      articles,
      drills: [...trues, oneFalse, statement(FALSE_II, false, ITEM_II)],
    });

    expect(result.dropped).toStrictEqual([]);

    const unbalanced = checkStatuteDrills({ articles, drills: [...trues, oneFalse] });
    const problem = "Dropped to balance true and false statements (4 true, 1 false).";

    expect(unbalanced.drills).toStrictEqual([...trues.slice(0, 3), oneFalse]);
    expect(unbalanced.dropped).toStrictEqual([{ drill: trues[3], problems: [problem] }]);
  });

  it("keeps one statement when every answer is the same", () => {
    const drills = [statement(TRUE_CAPUT, true), statement(TRUE_II, true, ITEM_II)];
    const result = checkStatuteDrills({ articles, drills });

    expect(result.drills).toStrictEqual([drills[0]]);

    expect(result.dropped.map((entry) => entry.problems)).toStrictEqual([
      ["Dropped to balance true and false statements (2 true, 0 false)."],
    ]);
  });
});
