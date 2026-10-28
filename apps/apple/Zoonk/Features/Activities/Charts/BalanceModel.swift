import Foundation

struct BalanceFields: Decodable, Hashable, Sendable {
  struct Equation: Decodable, Hashable, Sendable {
    let left: String
    let right: String
  }

  struct Step: Decodable, Hashable, Sendable {
    let left: String
    let right: String
    let move: String
  }

  struct Hint: Decodable, Hashable, Sendable {
    let hint: String
    let move: String
  }

  struct Object: Decodable, Hashable, Sendable {
    let label: String
    let symbol: String
  }

  let equation: Equation
  let hints: [Hint]
  let objects: [Object]
  let steps: [Step]
  let variable: String

  /// What a bag stands for and what a block stands for.
  var unknown: Object {
    objects.first { $0.symbol == variable } ?? Object(label: variable, symbol: variable)
  }

  var unit: Object {
    objects.first { $0.symbol != variable } ?? Object(label: "1", symbol: "1")
  }
}

/// Main's `balance-model.ts`: an equation as two pans of unknowns (bags) and units (blocks).
enum BalanceModel {
  struct Pan: Hashable {
    var units: Double
    var x: Double
  }

  struct State: Hashable {
    var left: Pan
    var right: Pan
  }

  enum Side {
    case left, right
  }

  enum Move: Hashable {
    case takeX(Side)
    case takeUnit(Side)
    case split(Int)
  }

  private static let slack = 1e-9

  /// Reads a linear side like `4*x + 1` as 4 unknowns and 1 unit; nil when it isn't linear.
  static func pan(_ expression: String, variable: String) -> Pan? {
    let values = [0.0, 1, 2].map { ChartsExpression.evaluate(expression, [variable: $0]) }

    guard let atZero = values[0], let atOne = values[1], let atTwo = values[2] else {
      return nil
    }

    let slope = atOne - atZero
    return abs(atTwo - (atZero + 2 * slope)) < slack ? Pan(units: atZero, x: slope) : nil
  }

  static func parse(left: String, right: String, variable: String) -> State? {
    guard let left = pan(left, variable: variable), let right = pan(right, variable: variable)
    else {
      return nil
    }

    return State(left: left, right: right)
  }

  /// The value of the unknown that keeps both pans level.
  static func solve(_ state: State) -> Double? {
    let slope = state.left.x - state.right.x
    return abs(slope) < slack ? nil : (state.right.units - state.left.units) / slope
  }

  private static func isCountable(_ value: Double, max: Double) -> Bool {
    value.rounded() == value && value >= 0 && value <= max
  }

  /// Whole, non-negative counts that fit on a pan and a bag weighing more than nothing; anything
  /// else is solved in symbols instead.
  static func canDrawBlocks(_ state: State, solution: Double?) -> Bool {
    guard let solution, solution > 0 else {
      return false
    }

    let pans = [state.left, state.right]

    return pans.allSatisfy { isCountable($0.x, max: 6) && isCountable($0.units, max: 12) }
      && pans.contains { $0.x > 0 }
  }

  /// How far the beam tips, in degrees: positive when the right pan is heavier.
  static func tilt(_ state: State, solution: Double) -> Double {
    let left = state.left.x * solution + state.left.units
    let right = state.right.x * solution + state.right.units
    let heavier = max(left, right)

    guard heavier > 0, abs(right - left) >= slack else {
      return 0
    }

    return (right - left) / heavier * 9
  }

  /// Split is possible when bags sit alone on one pan and only blocks on the other.
  static func splitGroups(_ state: State) -> Int? {
    let (bags, blocks) = state.left.x > 0 ? (state.left, state.right) : (state.right, state.left)
    return bags.x > 1 && bags.units == 0 && blocks.x == 0 ? Int(bags.x) : nil
  }

  static func apply(_ move: Move, to state: State) -> State {
    var next = state

    func take(_ pan: inout Pan, _ key: WritableKeyPath<Pan, Double>) {
      if pan[keyPath: key] > 0 {
        pan[keyPath: key] -= min(pan[keyPath: key], 1)
      }
    }

    switch move {
    case .split(let groups):
      let divide = { (pan: Pan) in Pan(units: pan.units / Double(groups), x: pan.x / Double(groups))
      }
      next = State(left: divide(state.left), right: divide(state.right))
    case .takeX(.left): take(&next.left, \.x)
    case .takeX(.right): take(&next.right, \.x)
    case .takeUnit(.left): take(&next.left, \.units)
    case .takeUnit(.right): take(&next.right, \.units)
    }

    return next
  }

  /// One bag alone against only blocks: the blocks' weight is the learner's answer.
  static func isolatedValue(_ state: State) -> Double? {
    if state.left.x == 1 && state.left.units == 0 && state.right.x == 0 {
      return state.right.units
    }

    return state.right.x == 1 && state.right.units == 0 && state.left.x == 0
      ? state.left.units : nil
  }

  private static func samePan(_ first: Pan, _ second: Pan) -> Bool {
    abs(first.x - second.x) < slack && abs(first.units - second.units) < slack
  }

  private static func matches(_ state: State, _ step: State) -> Bool {
    (samePan(state.left, step.left) && samePan(state.right, step.right))
      || (samePan(state.left, step.right) && samePan(state.right, step.left))
  }

  /// How many written steps the learner has reached, in order; reaching the answer counts them all.
  static func reachedSteps(current: State, history: [State], solution: Double, steps: [State?])
    -> Int
  {
    if let isolated = isolatedValue(current), abs(isolated - solution) < slack {
      return steps.count
    }

    let visited = history + [current]

    return steps.enumerated().reduce(0) { reached, item in
      guard reached == item.offset, let step = item.element,
        visited.contains(where: { matches($0, step) })
      else {
        return reached
      }

      return reached + 1
    }
  }

  /// A pan in symbols, like "2x + 1", "x" or "7".
  static func text(_ pan: Pan, symbol: String, format: (Double) -> String) -> String {
    let unknown = pan.x == 0 ? "" : "\(pan.x == 1 ? "" : format(pan.x))\(symbol)"
    let units = pan.units == 0 && !unknown.isEmpty ? "" : format(pan.units)

    return [unknown, units].filter { !$0.isEmpty }.joined(separator: " + ")
  }

  /// The next step's move among the written wrong moves, in a stable order that varies by step.
  static func moveChoices(next: String, wrongMoves: [String], index: Int) -> [String] {
    let moves = [next] + wrongMoves.filter { $0 != next }
    let shift = index % moves.count
    return Array(moves[shift...] + moves[..<shift])
  }
}
