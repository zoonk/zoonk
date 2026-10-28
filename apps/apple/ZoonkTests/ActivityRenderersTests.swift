import XCTest

@testable import Zoonk

/// On the fixtures main's player browser tests play (`@zoonk/testing/fixtures/activity-contents`),
/// each renderer's grade must agree with core's `checkActivityAnswer`.
final class ActivityRenderersTests: XCTestCase {
  func testShufflesLikeMainForTheSameSeed() {
    // Values from main's `seededShuffle` in `@zoonk/utils/seeded-random`.
    XCTAssertEqual(
      SeededShuffle.shuffled(["i1", "i2", "i3"], seed: "i1 i2 i3"), ["i2", "i3", "i1"])
    XCTAssertEqual(
      SeededShuffle.shuffled(["a", "b", "c", "d", "e", "f"], seed: "Photosynthesis: a,b,c,d,e,f"),
      ["a", "c", "d", "b", "f", "e"])
    XCTAssertEqual(SeededShuffle.hashSeed("évora 🙂 ok"), 2_079_340_494)
    XCTAssertEqual(
      SeededShuffle.shuffled(["x", "y", "z", "w"], seed: "évora 🙂 ok"), ["z", "w", "x", "y"])
  }

  func testEvaluatesCoreExpressions() {
    XCTAssertEqual(ActivityExpression.evaluate("1000000 / 86400")!, 11.574, accuracy: 0.001)
    XCTAssertEqual(ActivityExpression.evaluate("2 ^ 3 ^ 2"), 512)
    XCTAssertEqual(ActivityExpression.evaluate("-2 ^ 2"), -4)
    XCTAssertEqual(ActivityExpression.evaluate("round(2.5)"), 3)
    XCTAssertEqual(ActivityExpression.evaluate("round(-2.5)"), -2, "halves round up, as Math.round")
    XCTAssertEqual(ActivityExpression.evaluate("round(3.14159, 2)"), 3.14)
    XCTAssertEqual(
      ActivityExpression.evaluate("sqrt(16) + abs(-2) * pi")!, 4 + 2 * .pi, accuracy: 1e-12)
    XCTAssertEqual(ActivityExpression.evaluate("x * 2", variables: ["x": 3]), 6)
    XCTAssertNil(ActivityExpression.evaluate("1 / 0"))
    XCTAssertNil(ActivityExpression.evaluate("sqrt 4"))
    XCTAssertNil(ActivityExpression.evaluate("y + 1"))
    XCTAssertNil(ActivityExpression.evaluate("alert(1)"))
    XCTAssertNil(ActivityExpression.evaluate("(1 + 2"))
  }

  func testFormatsNumbersWithUnitsLikeMain() {
    XCTAssertEqual(ActivityNumberFormat.fractionDigits(1234), 0)
    XCTAssertEqual(ActivityNumberFormat.fractionDigits(12.34), 1)
    XCTAssertEqual(ActivityNumberFormat.fractionDigits(0.004), 5)
    XCTAssertTrue(ActivityNumberFormat.format(15, unit: "%").hasSuffix("15%"))
    XCTAssertTrue(ActivityNumberFormat.format(3, unit: "days").hasSuffix("\u{00A0}days"))
  }

  private let categorizeJSON = #"""
    {"template":"categorize","prompt":"Sort each change.","check":{"kind":"interaction","explanation":"Here is why."},
     "fields":{"groups":[{"id":"chemical","label":"New substance","rule":"Something new forms."},
                         {"id":"physical","label":"Same substance","rule":"Only the form changes."}],
               "items":[{"groupId":"chemical","id":"i1","text":"Burning wood","why":"Ash and gas form."},
                        {"groupId":"physical","id":"i2","text":"Melting ice","why":"It is still water."},
                        {"groupId":"chemical","id":"i3","text":"Rusting iron","why":"Iron oxide forms."}]}}
    """#

  func testCategorizeEveryItemInItsGroupIsRight() throws {
    let content = try content(categorizeJSON)
    let fields = try content.fields(as: CategorizeFields.self)
    let placements = ["i1": "chemical", "i2": "physical", "i3": "chemical"]

    let answer = try XCTUnwrap(CategorizePlacements.answer(fields.shuffledItems, placements))
    XCTAssertTrue(grade(.categorize, content, answer))
    XCTAssertEqual(
      fields.shuffledItems.map(\.id), ["i2", "i3", "i1"], "items show in main's order")
  }

  func testCategorizeAMisplacedItemIsWrongAndSaysWhereItBelongs() throws {
    let content = try content(categorizeJSON)
    let items = try content.fields(as: CategorizeFields.self).items
    let placements = ["i1": "physical", "i2": "physical", "i3": "chemical"]

    XCTAssertFalse(
      grade(.categorize, content, try XCTUnwrap(CategorizePlacements.answer(items, placements))))
    XCTAssertEqual(
      CategorizePlacements.misplaced(
        items, expected: ["i1": "chemical", "i2": "physical", "i3": "chemical"],
        placements: placements
      ).map(\.id), ["i1"])
  }

  func testCategorizeHasNoAnswerUntilEveryItemIsSorted() throws {
    let items = try content(categorizeJSON).fields(as: CategorizeFields.self).items

    XCTAssertNil(CategorizePlacements.answer(items, ["i1": "chemical", "i2": "physical"]))
    XCTAssertEqual(
      CategorizePlacements.nextUnplacedId(items, placedId: "i3", placements: ["i3": "chemical"]),
      "i1",
      "focus wraps around to the first item left")
    XCTAssertNil(
      CategorizePlacements.nextUnplacedId(
        items, placedId: "i3", placements: ["i1": "a", "i2": "b", "i3": "c"]))
  }

  func testProcessOrderTheTrueOrderIsRightAndTheShuffleNeverIs() throws {
    let content = try content(
      #"{"template":"processOrder","prompt":"Order the steps.","check":{"kind":"interaction","explanation":"x"},"fields":{"steps":[{"id":"s1","text":"One"},{"id":"s2","text":"Two","why":"After one"},{"id":"s3","text":"Three","why":"After two"}]}}"#
    )
    let steps = try content.fields(as: ProcessOrderFields.self).steps

    XCTAssertTrue(grade(.processOrder, content, .order(["s1", "s2", "s3"])))
    XCTAssertFalse(grade(.processOrder, content, .order(["s2", "s1", "s3"])))
    XCTAssertEqual(
      ProcessOrder.shuffled(steps, seed: "Order the steps.:s1,s2,s3").map(\.id), ["s2", "s1", "s3"])

    let inOrder = ProcessOrder.shuffled(steps, seed: "x")
    XCTAssertNotEqual(inOrder.map(\.id), ["s1", "s2", "s3"])
    XCTAssertEqual(
      ProcessOrder.results(expected: ["s1", "s2", "s3"], order: ["s2", "s1", "s3"]).map(
        \.learnerPosition),
      [2, 1, 3])
  }

  func testTimelinePlacesEventsInOrderOfTheirGuessedYears() throws {
    let content = try content(
      #"{"template":"timeline","prompt":"Place them.","check":{"kind":"interaction","explanation":"x"},"fields":{"anchors":[{"label":"Great Pyramid built","year":-2560}],"end":2000,"events":[{"id":"moon","label":"Moon landing","year":1969},{"id":"cleo","label":"Cleopatra rules Egypt","year":-51}],"start":-3000}}"#
    )
    let placements = [
      TimelineScale.Placement(id: "moon", year: 1500),
      TimelineScale.Placement(id: "cleo", year: -100),
    ]

    XCTAssertEqual(TimelineScale.placedOrder(placements), ["cleo", "moon"])
    XCTAssertTrue(grade(.timeline, content, .order(TimelineScale.placedOrder(placements))))
    XCTAssertFalse(grade(.timeline, content, .order(["moon", "cleo"])))
    XCTAssertEqual(TimelineScale.yearStep(start: -3000, end: 2000), 50)
    XCTAssertEqual(TimelineScale.snapYear(-490, start: -3000, end: 2000), -500)
    XCTAssertEqual(TimelineScale.yearsBetween(-51, 1969), 2019, "no year 0")
    XCTAssertEqual(TimelineScale.roundedGap(2019), 2000)
    XCTAssertFalse(TimelineScale.ticks(start: -3000, end: 2000).contains(0))
  }

  private let matchPairsJSON = #"""
    {"template":"matchPairs","prompt":"Match each word.","check":{"kind":"interaction","explanation":"x"},
     "fields":{"distractors":[{"side":"right","text":"embarrassed","why":"Embarrassed is avergonzada."},
                              {"side":"right","text":"library","why":"A library is a biblioteca."}],
               "pairs":[{"id":"a","left":"embarazada","right":"pregnant"},{"id":"b","left":"éxito","right":"success"},
                        {"id":"c","left":"librería","right":"bookstore"}]}}
    """#

  func testMatchPairsArrangesColumnsLikeMainWithNoPairSideBySide() throws {
    let fields = try content(matchPairsJSON).fields(as: MatchPairsFields.self)
    let columns = MatchPairs.columns(fields)

    XCTAssertEqual(columns.left.map(\.id), ["c", "a", "b"])
    XCTAssertEqual(columns.right.map(\.id), ["a", "right-trap-0", "c", "right-trap-1", "b"])
  }

  func testMatchPairsMatchingEachPairOnTheFirstTryIsRight() throws {
    let content = try content(matchPairsJSON)
    let fields = try content.fields(as: MatchPairsFields.self)
    let (left, right) = MatchPairs.columns(fields)
    var progress = MatchPairs.Progress()

    for id in ["a", "b", "c"] {
      XCTAssertNil(MatchPairs.answer(pairIds: ["a", "b", "c"], progress: progress))
      progress = MatchPairs.recordTry(
        progress, left: left.first { $0.id == id }!, right: right.first { $0.id == id }!)
    }

    XCTAssertTrue(
      grade(
        .matchPairs, content,
        try XCTUnwrap(MatchPairs.answer(pairIds: ["a", "b", "c"], progress: progress))))
  }

  func testMatchPairsAMissKeepsItsFirstTryAndATrapIsMarked() throws {
    let content = try content(matchPairsJSON)
    let (left, right) = MatchPairs.columns(try content.fields(as: MatchPairsFields.self))
    let card = { (side: [MatchCard], id: String) in side.first { $0.id == id }! }

    var progress = MatchPairs.recordTry(
      MatchPairs.Progress(), left: card(left, "a"), right: card(right, "right-trap-0"))
    XCTAssertEqual(progress.traps, ["right-trap-0"])
    XCTAssertEqual(
      MatchPairs.mismatch(left: card(left, "a"), right: card(right, "right-trap-0")).reason,
      "Embarrassed is avergonzada.")

    for id in ["a", "b", "c"] {
      progress = MatchPairs.recordTry(progress, left: card(left, id), right: card(right, id))
    }

    let answer = try XCTUnwrap(MatchPairs.answer(pairIds: ["a", "b", "c"], progress: progress))
    XCTAssertEqual(answer.pairs?["a"], "right-trap-0")
    XCTAssertFalse(grade(.matchPairs, content, answer), "matching by elimination doesn't count")
    XCTAssertEqual(MatchPairs.progress(from: answer).matched.sorted(), ["a", "b", "c"])
  }

  func testArgumentBuilderTheStrongQuoteAndReasoningAreRight() throws {
    let content = try content(
      #"{"template":"argumentBuilder","prompt":"Build it.","check":{"kind":"interaction","explanation":"x"},"fields":{"claim":"Romeo's love is impulsive.","evidence":[{"citation":"Act 2","id":"e1","isStrong":true,"quote":"Too rash.","why":"Speed."},{"citation":"Act 1","id":"e2","isStrong":false,"quote":"O brawling love!","why":"Rosaline."}],"reasoning":[{"id":"r1","isStrong":true,"text":"Juliet sees the rush.","why":"Ties."},{"id":"r2","isStrong":false,"text":"Love is common.","why":"Nothing."}]}}"#
    )

    XCTAssertTrue(
      grade(.argumentBuilder, content, .selection(["r1", "e1"])), "a selection is a set")
    XCTAssertFalse(grade(.argumentBuilder, content, .selection(["e2", "r1"])))
    XCTAssertFalse(grade(.argumentBuilder, content, .selection(["e1"])))
  }

  func testFindErrorDialogueAndSourcesGradeTheirSelection() throws {
    let findError = try content(
      #"{"template":"findError","prompt":"Find it.","check":{"kind":"interaction","explanation":"x"},"fields":{"correction":"96","errorStepId":"s2","problem":"Up then down.","steps":[{"id":"s1","text":"Up"},{"id":"s2","text":"Down"},{"id":"s3","text":"So"}],"why":"Bigger number."}}"#
    )
    XCTAssertTrue(grade(.findError, findError, .selection(["s2"])))
    XCTAssertFalse(grade(.findError, findError, .selection(["s3"])))

    let dialogue = try content(
      #"{"template":"dialogueSimulator","prompt":"Reply.","check":{"kind":"interaction","explanation":"x"},"fields":{"language":"es","lines":[{"speaker":"them","text":"Hola","translation":"Hi"}],"replies":[{"id":"polite","isBest":true,"text":"Buenos días","translation":"Good morning","why":"Polite."},{"id":"blunt","isBest":false,"text":"Dame","translation":"Give me","why":"Rude."}],"scene":"A pharmacy."}}"#
    )
    XCTAssertTrue(grade(.dialogueSimulator, dialogue, .selection(["polite"])))
    XCTAssertFalse(grade(.dialogueSimulator, dialogue, .selection(["blunt"])))

    let sources = try content(
      #"{"template":"sourceComparison","prompt":"Compare.","check":{"kind":"interaction","explanation":"x"},"fields":{"markPrompt":"Mark who fired first.","sources":[{"author":"A captain","citation":{"title":"Deposition","year":1775},"date":"April 1775","excerpt":"The regulars fired on us without any provocation.","id":"parker","passages":[{"id":"p1","isTarget":true,"text":"The regulars fired on us"}]},{"author":"An officer","citation":{"title":"Report","year":1775},"date":"April 1775","excerpt":"Some of the rebels fired first from behind a wall.","id":"pitcairn","passages":[{"id":"p2","isTarget":true,"text":"the rebels fired first"}]}]}}"#
    )
    XCTAssertTrue(grade(.sourceComparison, sources, .selection(["p2", "p1"])))
    XCTAssertFalse(grade(.sourceComparison, sources, .selection(["p1"])))
  }

  func testSplitsAnExcerptIntoTextAndPassagesLikeCore() {
    let passages = [
      SourceComparisonFields.Passage(id: "p2", isTarget: false, text: "behind a wall"),
      SourceComparisonFields.Passage(id: "p1", isTarget: true, text: "the rebels fired first"),
      SourceComparisonFields.Passage(id: "p3", isTarget: false, text: "fired first from"),
    ]

    XCTAssertEqual(
      ExcerptSegment.split(
        "Some of the rebels fired first from behind a wall.", passages: passages),
      [
        ExcerptSegment(passageId: nil, text: "Some of "),
        ExcerptSegment(passageId: "p1", text: "the rebels fired first"),
        ExcerptSegment(passageId: nil, text: " from "),
        ExcerptSegment(passageId: "p2", text: "behind a wall"),
        ExcerptSegment(passageId: nil, text: "."),
      ], "an overlapping passage is skipped")
  }

  func testCauseEffectLinksAreASet() throws {
    let content = try content(
      #"{"template":"causeEffectChain","prompt":"Link them.","check":{"kind":"interaction","explanation":"x"},"fields":{"links":[{"from":"plow","to":"dust","why":"Bare soil."},{"from":"drought","to":"dust","why":"Dry soil."}],"nodes":[{"id":"dust","label":"Dust storms","year":1934},{"id":"plow","label":"Prairie plowed","year":1920},{"id":"drought","label":"Drought","year":1931}]}}"#
    )
    let fields = try content.fields(as: CauseEffectFields.self)
    let link = ActivityExpectedAnswer.Link.init(from:to:)

    XCTAssertEqual(
      fields.orderedNodes.map(\.id), ["plow", "drought", "dust"], "dated nodes show in time order")
    XCTAssertTrue(
      grade(.causeEffectChain, content, .links([link("drought", "dust"), link("plow", "dust")])))
    XCTAssertFalse(grade(.causeEffectChain, content, .links([link("plow", "dust")])))
    XCTAssertFalse(
      grade(
        .causeEffectChain, content,
        .links([link("plow", "dust"), link("drought", "dust"), link("plow", "drought")])))
  }

  private let decisionTreeJSON = #"""
    {"template":"decisionTree","prompt":"Name the tree.","check":{"kind":"interaction","explanation":"x"},
     "fields":{"case":{"answers":[{"branch":"Needles","nodeId":"q1"},{"branch":"In bundles","nodeId":"q2"}],"description":"Needles in bundles.","outcomeId":"pine"},
       "nodes":[{"branches":[{"label":"Needles","next":"q2"},{"label":"Broad leaves","next":"oak"}],"id":"q1","kind":"question","question":"What are the leaves like?"},
                {"branches":[{"label":"In bundles","next":"pine"},{"label":"Single","next":"spruce"}],"id":"q2","kind":"question","question":"How do the needles grow?"},
                {"id":"pine","kind":"outcome","label":"Pine"},{"id":"spruce","kind":"outcome","label":"Spruce"},{"id":"oak","kind":"outcome","label":"Oak"}],
       "rootId":"q1"}}
    """#

  func testDecisionTreeTheCaseWalkIsRightAndAWrongBranchIsShown() throws {
    let content = try content(decisionTreeJSON)
    let fields = try content.fields(as: DecisionTreeFields.self)

    XCTAssertEqual(DecisionTreeWalk.casePath(fields), ["q1", "q2", "pine"])
    XCTAssertTrue(grade(.decisionTree, content, .order(["q1", "q2", "pine"])))
    XCTAssertFalse(grade(.decisionTree, content, .order(["q1", "q2", "spruce"])))
    XCTAssertEqual(
      DecisionTreeWalk.firstDivergence(
        expected: ["q1", "q2", "pine"], walked: ["q1", "q2", "spruce"]), 2)
    XCTAssertNil(
      DecisionTreeWalk.firstDivergence(
        expected: ["q1", "q2", "pine"], walked: ["q1", "q2", "pine"]))
    XCTAssertEqual(
      DecisionTreeWalk.steps(fields, path: ["q1", "q2", "spruce"]).map(\.branch),
      ["Needles", "Single"])
    XCTAssertEqual(
      DecisionTreeWalk.reachableOutcomes(fields, from: "q2").map(\.label), ["Pine", "Spruce"])
  }

  func testCombinationGridGenotypesMatchInEitherOrder() throws {
    let content = try content(
      #"{"template":"combinationGrid","prompt":"Fill it.","check":{"kind":"interaction","explanation":"x"},"fields":{"columns":{"label":"White parent","values":["p","p"]},"rows":{"label":"Purple parent","values":["P","p"]},"rule":"alleles","title":"Flower color","traits":{"dominant":"Purple","recessive":"White"}}}"#
    )
    let fields = try content.fields(as: CombinationGridFields.self)

    XCTAssertEqual(CombinationGrid.cells(fields), ["Pp", "Pp", "pp", "pp"])
    XCTAssertEqual(CombinationGrid.options(fields), ["PP", "Pp", "pp"])
    XCTAssertTrue(grade(.combinationGrid, content, .grid(["pP", "Pp", "pp", "pp"])))
    XCTAssertFalse(grade(.combinationGrid, content, .grid(["PP", "Pp", "pp", "pp"])))
    XCTAssertEqual(CombinationGrid.share(["Pp", "Pp", "pp", "pp"], output: "recessive"), 0.5)
    XCTAssertNil(CombinationGrid.share(["Pp", nil, "pp", "pp"], output: "recessive"))
  }

  func testCombinationGridNumbersCombineAndBigGridsAreShownFilled() throws {
    let times = try content(
      #"{"template":"combinationGrid","prompt":"Fill it.","check":{"kind":"interaction","explanation":"x"},"fields":{"columns":{"label":"Times","values":[1,2,3]},"rows":{"label":"Number","values":[2,3,4]},"rule":"product","title":"Times table"}}"#
    )
    let dice = try content(
      #"{"template":"combinationGrid","prompt":"Dice.","check":{"kind":"numeric","question":"?","answer":0.1667,"explanation":"x","tolerance":{"kind":"absolute","value":0.01},"output":"7"},"fields":{"columns":{"label":"Second die","values":[1,2,3,4,5,6]},"rows":{"label":"First die","values":[1,2,3,4,5,6]},"rule":"sum","title":"Two dice"}}"#
    )
    let diceFields = try dice.fields(as: CombinationGridFields.self)

    XCTAssertEqual(
      CombinationGrid.cells(try times.fields(as: CombinationGridFields.self)),
      ["2", "4", "6", "3", "6", "9", "4", "8", "12"])
    XCTAssertTrue(
      grade(.combinationGrid, times, .grid(["2", "4", "6", "3", "6", "9", "4", "8", "12"])))
    XCTAssertFalse(CombinationGrid.isFillable(diceFields))
    XCTAssertEqual(
      CombinationGrid.share(CombinationGrid.cells(diceFields), output: "7")!, 6.0 / 36,
      accuracy: 1e-9)
  }

  func testStepSolverKeepsEachStepsFirstPick() throws {
    let content = try content(
      #"{"template":"stepSolver","prompt":"Solve it.","check":{"kind":"interaction","explanation":"x"},"fields":{"problem":"A $60 jacket is 25% off.","steps":[{"choices":[{"id":"a","isCorrect":true,"reason":"First.","text":"Take 25% off"},{"id":"b","isCorrect":false,"reason":"Discount first.","text":"Add the tax"}],"expression":"60 * (1 - 0.25)","id":"discount","math":"60 − 15 = 45","prompt":"What comes first?","value":45},{"choices":[{"id":"a","isCorrect":false,"reason":"Before.","text":"$60"},{"id":"b","isCorrect":true,"reason":"What you pay.","text":"$45"}],"expression":"45 * 0.08","id":"tax","math":"8% of 45","prompt":"Which price?","value":3.6}]}}"#
    )
    let steps = try content.fields(as: StepSolverFields.self).steps
    var picks = StepSolver.adding([:], stepId: "discount", choiceId: "a")

    XCTAssertEqual(StepSolver.currentIndex(steps, picks: picks), 1)
    XCTAssertNil(StepSolver.firstPicks(steps, picks: picks))

    picks = StepSolver.adding(picks, stepId: "tax", choiceId: "a")
    picks = StepSolver.adding(picks, stepId: "tax", choiceId: "b")
    let pairs = try XCTUnwrap(StepSolver.firstPicks(steps, picks: picks))

    XCTAssertEqual(pairs, ["discount": "a", "tax": "a"])
    XCTAssertFalse(
      grade(.stepSolver, content, .assignment(pairs)), "a wrong first pick doesn't count")
    XCTAssertTrue(grade(.stepSolver, content, .assignment(["discount": "a", "tax": "b"])))
  }

  func testLabeledDiagramNamesEachNumberedSpot() throws {
    let content = try content(
      #"{"template":"labeledDiagram","prompt":"Name the parts.","check":{"kind":"interaction","explanation":"x"},"fields":{"distractors":["Pulmonary valve"],"mixUps":[{"feedback":"The picture faces you.","labels":["Right atrium","Left atrium"]}],"parts":[{"label":"Right atrium","part":"right atrium"},{"label":"Left atrium","part":"left atrium"}],"picture":{"alt":"A heart","prompt":"A heart"}}}"#
    )
    let fields = try content.fields(as: LabeledDiagramFields.self)

    XCTAssertTrue(
      grade(.labeledDiagram, content, .assignment(["1": "Right atrium", "2": "Left atrium"])))
    XCTAssertFalse(
      grade(.labeledDiagram, content, .assignment(["1": "Left atrium", "2": "Right atrium"])))
    XCTAssertEqual(
      fields.mixUpFeedback(correct: "Right atrium", placed: "Left atrium"), "The picture faces you."
    )
    XCTAssertNil(fields.mixUpFeedback(correct: "Right atrium", placed: "Pulmonary valve"))
  }

  func testDescribesChangesAndGuessesLikeMain() {
    XCTAssertEqual(FactChange(ratio: 1.5 / 12.5), .less(8.3))
    XCTAssertEqual(FactChange(ratio: 3), .more(3))
    XCTAssertEqual(FactChange(ratio: 1.15), .percent(15))
    XCTAssertEqual(FactChange(ratio: 1), .same)

    let scale = GuessScale(min: 1, max: 3650, kind: .log)
    XCTAssertEqual(scale.value(atPosition: 0), 1, accuracy: 1e-9)
    XCTAssertEqual(scale.value(atPosition: GuessScale.positions), 3650, accuracy: 1e-6)
    XCTAssertEqual(scale.share(of: 3650), 1, accuracy: 1e-9)
    XCTAssertEqual(GuessScale.roundGuess(2871.3), 2900)
    XCTAssertEqual(GuessScale.compare(guess: 40, actual: 11.57, isCorrect: false), .tooBig(3.5))
    XCTAssertEqual(GuessScale.compare(guess: 11, actual: 11.57, isCorrect: true), .close)
  }

  private func content(_ json: String) throws -> ActivityStepContent {
    try JSONDecoder().decode(ActivityStepContent.self, from: Data(json.utf8))
  }

  private func grade(
    _ renderer: ActivityRenderer, _ content: ActivityStepContent, _ answer: ActivityAnswer?
  )
    -> Bool
  {
    guard let answer, let grade = renderer.grade else {
      return false
    }

    return grade(content, answer)
  }
}
