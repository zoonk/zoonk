import Foundation

/// Core's safe formula language (`library/activities/expression`), ported so sliders, readouts and
/// pattern checks compute exactly what grading computes: numbers, variables, `+ - * / ^`,
/// parentheses, unary minus, `pi`, `e` and a whitelist of functions. It parses to a tree and never
/// runs code; anything that isn't finite fails instead of turning into NaN further up.
enum ChartsExpression {
  private static let maxLength = 300
  private static let maxDepth = 32

  indirect enum Node: Sendable {
    case number(Double)
    case constant(Double)
    case variable(String)
    case negate(Node)
    case binary(Character, Node, Node)
    case call(String, [Node])
  }

  /// Parses and evaluates a formula; nil when it can't be read or isn't finite for these values.
  static func evaluate(_ source: String, _ variables: [String: Double] = [:]) -> Double? {
    parse(source).flatMap { evaluate($0, variables) }
  }

  static func parse(_ source: String) -> Node? {
    guard source.utf16.count <= maxLength, let tokens = tokenize(source) else {
      return nil
    }

    var parser = Parser(tokens: tokens)

    guard let node = parser.additive(depth: 0), case .end = parser.current else {
      return nil
    }

    return node
  }

  static func evaluate(_ node: Node, _ variables: [String: Double]) -> Double? {
    let value: Double?

    switch node {
    case .number(let number):
      value = number
    case .constant(let constant):
      value = constant
    case .variable(let name):
      value = variables[name]
    case .negate(let argument):
      value = evaluate(argument, variables).map { -$0 }
    case .binary(let symbol, let left, let right):
      guard let left = evaluate(left, variables), let right = evaluate(right, variables) else {
        return nil
      }

      value = apply(symbol, left, right)
    case .call(let name, let arguments):
      let values = arguments.compactMap { evaluate($0, variables) }

      guard values.count == arguments.count, let function = functions[name] else {
        return nil
      }

      value = function.apply(values)
    }

    return value.flatMap { $0.isFinite ? $0 : nil }
  }

  private static func apply(_ symbol: Character, _ left: Double, _ right: Double) -> Double {
    switch symbol {
    case "+": left + right
    case "-": left - right
    case "*": left * right
    case "/": left / right
    case "^": pow(left, right)
    default: .nan
    }
  }

  // MARK: - Functions

  private struct Function: Sendable {
    let minArgs: Int
    let maxArgs: Int
    let apply: @Sendable ([Double]) -> Double

    static func unary(_ apply: @escaping @Sendable (Double) -> Double) -> Function {
      Function(minArgs: 1, maxArgs: 1) { apply($0.first ?? .nan) }
    }
  }

  /// JavaScript's `Math.round`: halves round up, so -2.5 is -2.
  static func jsRound(_ value: Double) -> Double {
    (value + 0.5).rounded(.down)
  }

  private static func roundTo(_ args: [Double]) -> Double {
    let value = args.first ?? .nan
    let digits = args.count > 1 ? args[1] : 0

    guard digits.rounded() == digits, digits >= 0, digits <= 10 else {
      return .nan
    }

    let factor = pow(10, digits)
    return jsRound(value * factor) / factor
  }

  private static func sign(_ value: Double) -> Double {
    value > 0 ? 1 : value < 0 ? -1 : value
  }

  private static let functions: [String: Function] = [
    "abs": .unary { abs($0) },
    "acos": .unary(acos),
    "asin": .unary(asin),
    "atan": .unary(atan),
    "cbrt": .unary(cbrt),
    "ceil": .unary { $0.rounded(.up) },
    "cos": .unary(cos),
    "deg": .unary { $0 * 180 / .pi },
    "exp": .unary(exp),
    "floor": .unary { $0.rounded(.down) },
    "ln": .unary(log),
    "log": .unary(log),
    "log10": .unary(log10),
    "log2": .unary(log2),
    "max": Function(minArgs: 1, maxArgs: .max) { $0.max() ?? .nan },
    "min": Function(minArgs: 1, maxArgs: .max) { $0.min() ?? .nan },
    "rad": .unary { $0 * .pi / 180 },
    "round": Function(minArgs: 1, maxArgs: 2, apply: roundTo),
    "sign": .unary(sign),
    "sin": .unary(sin),
    "sqrt": .unary(sqrt),
    "tan": .unary(tan),
  ]

  private static let constants: [String: Double] = ["e": M_E, "pi": .pi]

  // MARK: - Tokens

  private enum Token {
    case number(Double)
    case identifier(String)
    case symbol(Character)
    case end
  }

  private static func isIdentifierStart(_ scalar: Unicode.Scalar) -> Bool {
    scalar == "_" || ("a"..."z").contains(scalar) || ("A"..."Z").contains(scalar)
  }

  private static func isDigit(_ scalar: Unicode.Scalar) -> Bool {
    ("0"..."9").contains(scalar)
  }

  private static func tokenize(_ source: String) -> [Token]? {
    let scalars = Array(source.unicodeScalars)
    var tokens: [Token] = []
    var index = 0

    while index < scalars.count {
      let scalar = scalars[index]

      if CharacterSet.whitespacesAndNewlines.contains(scalar) {
        index += 1
      } else if isDigit(scalar)
        || (scalar == "." && index + 1 < scalars.count
          && isDigit(scalars[index + 1]))
      {
        let start = index
        while index < scalars.count && isDigit(scalars[index]) { index += 1 }
        if index < scalars.count && scalars[index] == "." {
          index += 1
          while index < scalars.count && isDigit(scalars[index]) { index += 1 }
        }
        if index < scalars.count, scalars[index] == "e" || scalars[index] == "E" {
          var next = index + 1
          if next < scalars.count, scalars[next] == "+" || scalars[next] == "-" { next += 1 }
          if next < scalars.count, isDigit(scalars[next]) {
            index = next
            while index < scalars.count && isDigit(scalars[index]) { index += 1 }
          }
        }
        let text = String(String.UnicodeScalarView(scalars[start..<index]))
        guard let value = Double(text) else { return nil }
        tokens.append(.number(value))
      } else if isIdentifierStart(scalar) {
        let start = index
        while index < scalars.count,
          isIdentifierStart(scalars[index]) || isDigit(scalars[index])
        {
          index += 1
        }
        tokens.append(.identifier(String(String.UnicodeScalarView(scalars[start..<index]))))
      } else if "(),*+/^-".unicodeScalars.contains(scalar) {
        tokens.append(.symbol(Character(scalar)))
        index += 1
      } else {
        return nil
      }
    }

    return tokens + [.end]
  }

  // MARK: - Parser

  /// A recursive descent parser with core's precedence: `+ -`, then `* /`, then unary minus (looser
  /// than `^`, so `-2^2` is -4), then right-associative `^`.
  private struct Parser {
    let tokens: [Token]
    var index = 0

    var current: Token { index < tokens.count ? tokens[index] : .end }

    private func isSymbol(_ symbol: Character) -> Bool {
      if case .symbol(let found) = current { return found == symbol }
      return false
    }

    mutating func additive(depth: Int) -> Node? {
      guard var left = multiplicative(depth: depth) else { return nil }

      while case .symbol(let symbol) = current, symbol == "+" || symbol == "-" {
        index += 1
        guard let right = multiplicative(depth: depth) else { return nil }
        left = .binary(symbol, left, right)
      }

      return left
    }

    mutating func multiplicative(depth: Int) -> Node? {
      guard var left = unary(depth: depth) else { return nil }

      while case .symbol(let symbol) = current, symbol == "*" || symbol == "/" {
        index += 1
        guard let right = unary(depth: depth) else { return nil }
        left = .binary(symbol, left, right)
      }

      return left
    }

    mutating func unary(depth: Int) -> Node? {
      guard depth <= ChartsExpression.maxDepth else { return nil }

      if isSymbol("+") {
        index += 1
        return unary(depth: depth + 1)
      }

      guard isSymbol("-") else {
        return power(depth: depth)
      }

      index += 1
      return unary(depth: depth + 1).map { .negate($0) }
    }

    mutating func power(depth: Int) -> Node? {
      guard let base = primary(depth: depth) else { return nil }
      guard isSymbol("^") else { return base }
      index += 1
      return unary(depth: depth + 1).map { .binary("^", base, $0) }
    }

    mutating func primary(depth: Int) -> Node? {
      switch current {
      case .number(let value):
        index += 1
        return .number(value)
      case .identifier(let name):
        return identifier(name, depth: depth)
      case .symbol("("):
        index += 1
        guard let inner = additive(depth: depth + 1), isSymbol(")") else { return nil }
        index += 1
        return inner
      default:
        return nil
      }
    }

    mutating func identifier(_ name: String, depth: Int) -> Node? {
      index += 1
      let lowered = name.lowercased()

      guard isSymbol("(") else {
        // A function needs parentheses; constants are case-sensitive, like core's.
        guard ChartsExpression.functions[lowered] == nil else { return nil }
        return ChartsExpression.constants[name].map { .constant($0) } ?? .variable(name)
      }

      guard let function = ChartsExpression.functions[lowered] else { return nil }
      index += 1
      var arguments: [Node] = []

      if isSymbol(")") {
        index += 1
      } else {
        while true {
          guard let argument = additive(depth: depth + 1) else { return nil }
          arguments.append(argument)

          if isSymbol(",") {
            index += 1
          } else if isSymbol(")") {
            index += 1
            break
          } else {
            return nil
          }
        }
      }

      guard arguments.count >= function.minArgs, arguments.count <= function.maxArgs else {
        return nil
      }

      return .call(lowered, arguments)
    }
  }
}
