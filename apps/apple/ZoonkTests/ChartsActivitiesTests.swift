import XCTest

@testable import Zoonk

/// The chart, slider and plot templates' math, against the values main's TypeScript computes for
/// the same inputs (core's templates, `@zoonk/utils/seeded-random`, the player's helpers), so the
/// app's readouts, simulations and verdicts agree with grading.
final class ChartsActivitiesTests: XCTestCase {
  // MARK: - Shared helpers

  func testEvaluatesFormulasLikeCore() {
    XCTAssertEqual(ChartsExpression.evaluate("-2^2"), -4)
    XCTAssertEqual(ChartsExpression.evaluate("2^3^2"), 512)
    XCTAssertEqual(ChartsExpression.evaluate("round(2.345, 2)"), 2.35)
    XCTAssertEqual(ChartsExpression.evaluate("round(-2.5)"), -2)
    XCTAssertEqual(ChartsExpression.evaluate("max(1, 3, 2)"), 3)
    XCTAssertEqual(ChartsExpression.evaluate("rad(180)"), .pi)
    XCTAssertEqual(ChartsExpression.evaluate("Sin(pi/2)"), 1)
    XCTAssertEqual(ChartsExpression.evaluate("e"), M_E)
    XCTAssertEqual(ChartsExpression.evaluate("1e3 + .5"), 1000.5)
    XCTAssertEqual(ChartsExpression.evaluate("A1*(1+B1)", ["A1": 100, "B1": 0.2]), 120)
  }

  func testRefusesWhatCoreRefuses() {
    XCTAssertNil(ChartsExpression.evaluate("1/0"))
    XCTAssertNil(ChartsExpression.evaluate("2x"))
    XCTAssertNil(ChartsExpression.evaluate("sqrt(-1)"))
    XCTAssertNil(ChartsExpression.evaluate("sin"))
    XCTAssertNil(ChartsExpression.evaluate("x + 1"))
    XCTAssertNil(ChartsExpression.evaluate("round(1, 0.5)"))
  }

  func testSeedsLikeMain() {
    var random = ChartsRandom(seed: 42)
    XCTAssertEqual(random.next(), 0.0009665507832230542, accuracy: 1e-15)
    XCTAssertEqual(random.next(), 0.6563953130099879, accuracy: 1e-15)
    XCTAssertEqual(random.next(), 0.8581620285829176, accuracy: 1e-15)

    var normal = ChartsRandom(seed: 7)
    XCTAssertEqual(normal.standardNormal(), -0.008046984382329135, accuracy: 1e-12)

    XCTAssertEqual(ChartsRandom.hashSeed("hello"), 99_162_322)
    XCTAssertEqual(ChartsRandom.hashSeed("x😀y"), 128_836_865)
  }

  func testSnapsLikeMainsHandles() {
    XCTAssertEqual(ChartsMath.snap(0.30000000004, min: 0, max: 1, step: 0.1), 0.3)
    XCTAssertEqual(ChartsMath.snap(7.4, min: -5, max: 6, step: 1), 6)
    XCTAssertEqual(ChartsMath.snap(-3.6, min: -5, max: 6, step: 1), -4)
    XCTAssertTrue(ChartsMath.isMultiple(152.5, of: 2.5))
    XCTAssertFalse(ChartsMath.isMultiple(152.5, of: 5))
  }

  func testFormatsUnitsLikeMain() {
    let format = ChartsNumberFormat(locale: Locale(identifier: "en_US"))

    XCTAssertEqual(format(24, unit: "%", signed: true), "+24%")
    XCTAssertEqual(format(130.5, unit: "m"), "130.5\u{00A0}m")
    XCTAssertEqual(format(-3), "\u{2212}3")
    XCTAssertEqual(format(1960, grouping: false), "1960")
    XCTAssertEqual(format(3869.68, unit: "$"), "$3,870")
    XCTAssertEqual(format(3.5, unit: "$"), "$3.50")
    XCTAssertEqual(format(0.000075), "0.000075")
  }

  // MARK: - Charts

  func testMeasuresChartSpans() throws {
    let fields: ChartReaderFields = try decode(
      """
      {"points":[{"x":1960,"y":317},{"x":1970,"y":326},{"x":2010,"y":390},{"x":2020,"y":414}],
       "spans":[{"from":1960,"id":"early","label":"1960 to 1970","to":1970},
                {"from":2010,"id":"late","label":"2010 to 2020","to":2020}],
       "statistic":"change","xLabel":"Year","yLabel":"CO₂ (ppm)"}
      """)

    XCTAssertEqual(fields.measure("late"), 24)
    XCTAssertEqual(fields.measure("early"), 9)
    XCTAssertEqual(fields.measure(nil), 9)
    XCTAssertTrue(fields.hasPlainX)
  }

  func testDistributionSharesAndHandleStep() throws {
    let fields: DistributionExplorerFields = try decode(
      """
      {"distribution":{"kind":"normal","mean":100,"sd":15},"handles":{"from":90,"to":110},
       "target":{"from":70,"to":130},"unit":"IQ points","valueLabel":"IQ score"}
      """)

    XCTAssertEqual(
      DistributionModel.percent(fields.distribution, fields.target), 95.44998742254873,
      accuracy: 1e-9)

    let domain = DistributionModel.domain(fields)
    XCTAssertEqual(domain, 47.5...152.5)
    let step = DistributionModel.step(fields, domain: domain)
    XCTAssertEqual(step, 5)
    XCTAssertEqual(DistributionModel.snapped(domain, step: step), 45...155)
  }

  func testChanceRunsAreSeededLikeMain() {
    let binomial = RandomSimulationFields.Model.binomial(
      trials: 10, probability: 0.5, hit: .init(comparison: .exactly, value: 5))
    XCTAssertEqual(ChanceModel.run(binomial, runs: 5, seed: 123), [4, 8, 5, 7, 2])
    XCTAssertEqual(ChanceModel.exactChance(binomial), 0.24609375, accuracy: 1e-12)

    let dice = RandomSimulationFields.Model.diceSum(
      count: 2, sides: 6, hit: .init(comparison: .atLeast, value: 10))
    XCTAssertEqual(ChanceModel.run(dice, runs: 5, seed: 9), [7, 7, 11, 7, 7])
    XCTAssertEqual(ChanceModel.exactChance(dice), 6.0 / 36, accuracy: 1e-12)

    XCTAssertEqual(
      ChanceModel.exactChance(.sharedBirthday(people: 23, days: 365)), 0.5072972343239854,
      accuracy: 1e-12)
  }

  func testSamplingRunsAreSeededLikeMain() {
    let poll = SamplingModel.simulate(.proportion(0.5), runs: 200, seed: 11, size: 400)
    XCTAssertEqual(Array(poll.prefix(3)), [0.47, 0.475, 0.5])
    XCTAssertEqual(SamplingModel.middleRange(poll), 0.45...0.545)

    let heights = SamplingModel.simulate(.mean(170, sd: 10), runs: 3, seed: 5, size: 25)
    XCTAssertEqual(heights[0], 169.96721907913445, accuracy: 1e-9)
    XCTAssertEqual(heights[2], 172.3476576542692, accuracy: 1e-9)

    XCTAssertEqual(
      SamplingModel.simulate(.proportion(0.3), runs: 3, seed: 5, size: 5000),
      [0.2998, 0.2948, 0.3076])
    XCTAssertEqual(SamplingModel.digits(margin: 0.049, population: .proportion(0.5)), 0)
    XCTAssertEqual(SamplingModel.digits(margin: 0.005, population: .proportion(0.5)), 1)
  }

  func testNumberLineStopsAndTicks() throws {
    let fields: NumberLineFields = try decode(
      """
      {"label":"Temperature","max":6,"min":-5,"moves":[{"by":3},{"by":5}],"start":-3,"step":1,"unit":"°C"}
      """)

    XCTAssertEqual(fields.stops, [-3, 0, 5])
    XCTAssertEqual(fields.landing, 5)
    XCTAssertEqual(fields.ticks.count, 12)
    XCTAssertTrue(fields.ticks.allSatisfy(\.isLabelled))
  }

  func testLineCrossingMovesAndGrades() throws {
    let fields: LineCrossingFields = try decode(
      """
      {"change":"Bird flu cut the number of laying hens.",
       "feedback":{"wrongDirection":"Fewer hens.","wrongLine":"Not demand."},
       "lines":[{"id":"supply","intercept":1,"label":"Supply","slope":0.5},
                {"id":"demand","intercept":10,"label":"Demand","slope":-1}],
       "shift":{"amount":2,"direction":"left","line":"supply"},"xLabel":"Eggs sold","yLabel":"Price"}
      """)

    let supply = LineCrossingModel.line(fields.lines[0])
    let demand = LineCrossingModel.line(fields.lines[1])
    XCTAssertEqual(LineCrossingModel.crossing(supply, demand), .init(x: 6, y: 4))

    // Left moves each price to 2 fewer eggs: y = 1 + 0.5 (x + 2).
    let moved = LineCrossingModel.moved(supply, by: -2, axis: .horizontal)
    XCTAssertEqual(moved.intercept, 2)
    XCTAssertEqual(LineCrossingModel.crossing(moved, demand).x, 16.0 / 3, accuracy: 1e-12)

    let right = try ActivityAnswer(encoding: LineShiftAnswer(curve: "supply", direction: .left))
    let wrongWay = try ActivityAnswer(encoding: LineShiftAnswer(curve: "supply", direction: .right))
    let wrongLine = try ActivityAnswer(encoding: LineShiftAnswer(curve: "demand", direction: .left))
    XCTAssertTrue(LineCrossingModel.grade(fields, right))
    XCTAssertFalse(LineCrossingModel.grade(fields, wrongWay))
    XCTAssertFalse(LineCrossingModel.grade(fields, wrongLine))
  }

  func testFormulaModelReadsOutputsLikeCore() throws {
    let fields: FormulaModelFields = try decode(
      """
      {"compareAt":5,"outputs":[{"formula":"1000 * (1 + rate / 100) ^ 20","id":"value","label":"Value","unit":"$"}],
       "variables":[{"initial":5,"label":"Rate","max":12,"min":0,"name":"rate","step":0.5,"unit":"%"}]}
      """)

    XCTAssertEqual(
      fields.value(output: nil, inputs: ["rate": 7])!, 3869.6844624861833, accuracy: 1e-9)
    XCTAssertNil(fields.value(output: nil, inputs: ["rate": 13]), "Out of the slider's range")
    XCTAssertNil(fields.value(output: nil, inputs: ["other": 1]), "Not a slider")

    let scenario: FormulaModelFields = try decode(
      """
      {"events":[{"label":"Rent goes up $500","name":"rentUp"}],
       "outputs":[{"formula":"price * 1000 - 2000 - rentUp * 500","id":"profit","label":"Profit"}],
       "variables":[{"initial":3,"label":"Price","max":6,"min":2,"name":"price","step":0.5}]}
      """)

    XCTAssertEqual(scenario.value(output: "profit", inputs: [:]), 1000)
    XCTAssertEqual(scenario.value(output: "profit", inputs: ["rentUp": 1, "price": 4]), 1500)

    let view = FormulaModelView(
      fields: scenario, axis: scenario.variables[0], charted: scenario.outputs[0],
      sliders: ["price": 3], events: ["rentUp": 1])
    XCTAssertEqual(view.delta, -500)
    XCTAssertEqual(view.baseline?.kind, .whatIf)
  }

  func testPatternTableEndingsAndGrading() throws {
    let fields: PatternTableFields = try decode(
      """
      {"choices":["áis","éis","ís","en"],"modelWord":"hablar","newWord":"comer",
       "rows":[{"answer":"como","blank":false,"label":"yo","model":"hablo"},
               {"answer":"coméis","blank":true,"label":"vosotros","model":"habláis"},
               {"answer":"comen","blank":true,"label":"ellos","model":"hablan"}]}
      """)

    XCTAssertEqual(fields.expected, ["1": "éis", "2": "en"])
    XCTAssertEqual(fields.stem(fields.rows[1]), "com")
    XCTAssertEqual(PatternTableFields.commonStem(["hablo", "hablas", "habla"]), "habl")
    XCTAssertEqual(fields.nextOpenBlank(after: nil, filled: [:]), 1)
    XCTAssertEqual(fields.nextOpenBlank(after: 1, filled: ["1": "éis"]), 2)
    XCTAssertNil(fields.nextOpenBlank(after: 2, filled: ["1": "éis", "2": "en"]))

    XCTAssertTrue(
      fields.grade(
        try ActivityAnswer(encoding: PatternTableAnswer(pairs: ["1": "éis", "2": "en"]))))
    XCTAssertFalse(
      fields.grade(
        try ActivityAnswer(encoding: PatternTableAnswer(pairs: ["1": "áis", "2": "en"]))))
    XCTAssertFalse(
      fields.grade(try ActivityAnswer(encoding: PatternTableAnswer(pairs: ["1": "éis"]))))
  }

  func testPatternTesterGradesRegexesAndFormulasLikeCore() throws {
    XCTAssertFalse(PatternRegex.isSafe("(a+)+"))
    XCTAssertFalse(PatternRegex.isSafe("(a|aa)*"))
    XCTAssertFalse(PatternRegex.isSafe("(\\w)\\1"))
    XCTAssertTrue(PatternRegex.isSafe("^\\d{5}(-\\d{4})?$"))
    XCTAssertTrue(PatternRegex.isSafe("[(]+"))
    XCTAssertTrue(PatternRegex.isSafe("(ab)?c+"))

    let zip: PatternTesterFields = try decode(
      """
      {"hints":[],"mode":"regex","shouldMatch":["94103","94103-1234"],
       "shouldNotMatch":["9410","941031","94103-12"],"solution":"^\\\\d{5}(-\\\\d{4})?$","task":"ZIP"}
      """)

    XCTAssertTrue(
      zip.grade(try ActivityAnswer(encoding: PatternTesterAnswer(pattern: "^\\d{5}(-\\d{4})?$"))))
    XCTAssertFalse(zip.grade(try ActivityAnswer(encoding: PatternTesterAnswer(pattern: "^\\d{5}"))))
    XCTAssertFalse(zip.grade(try ActivityAnswer(encoding: PatternTesterAnswer(pattern: "(\\d+)+"))))

    if case .regex(let regex) = zip, let results = PatternRegex.test("\\d{5}", regex: regex) {
      XCTAssertEqual(results.shouldMatch.map(\.match), [0..<5, 0..<5])
      XCTAssertEqual(results.shouldNotMatch.map(\.passes), [true, false, false])
    } else {
      XCTFail("The pattern should compile")
    }

    let price: PatternTesterFields = try decode(
      """
      {"examples":[{"inputs":[{"name":"A1","value":100},{"name":"B1","value":0.2}],"output":120},
                   {"inputs":[{"name":"A1","value":50},{"name":"B1","value":0.1}],"output":55}],
       "hints":[],"mode":"formula","solution":"A1*(1+B1)","task":"Price",
       "tolerance":{"kind":"absolute","value":0.01}}
      """)

    XCTAssertTrue(
      price.grade(try ActivityAnswer(encoding: PatternTesterAnswer(pattern: "=A1*(1+B1)"))))
    XCTAssertFalse(price.grade(try ActivityAnswer(encoding: PatternTesterAnswer(pattern: "A1*B1"))))
  }

  // MARK: - Renderers

  func testRegistersEveryChartTemplate() {
    let registry = ActivityRendererRegistry(ChartsActivities.renderers)

    for template in [
      "chartReader", "distributionExplorer", "randomSimulation", "numberLine", "lineCrossing",
      "formulaModel", "patternTable", "patternTester",
    ] {
      XCTAssertNotNil(registry.renderer(for: template), template)
    }

    XCTAssertNotNil(registry.renderer(for: "lineCrossing")?.grade)
  }

  private func decode<Value: Decodable>(_ json: String) throws -> Value {
    try JSONDecoder().decode(Value.self, from: Data(json.utf8))
  }
}
