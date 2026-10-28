import Foundation

/// Core's safe expression language (`library/activities/expression`): numbers, variables,
/// `+ - * / ^`, parentheses, unary minus, `pi`, `e` and its functions. It parses and evaluates
/// arithmetic only, never code, and gives nil for anything core would reject (a syntax error, an
/// unknown name, a number that isn't finite), so a value the app shows is the one core computed.
enum ActivityExpression {
  private static let maxLength = 300
  private static let maxDepth = 32

  static func evaluate(_ source: String, variables: [String: Double] = [:]) -> Double? {
    guard source.count <= maxLength, let tokens = tokenize(source) else {
      return nil
    }

    var parser = Parser(tokens: tokens, variables: variables)

    guard let value = parser.additive(depth: 0), parser.isAtEnd, value.isFinite else {
      return nil
    }

    return value
  }

  // MARK: - Tokens

  private enum Token: Equatable {
    case number(Double)
    case identifier(String)
    case symbol(Character)
  }

  private static func tokenize(_ source: String) -> [Token]? {
    var tokens: [Token] = []
    var index = source.startIndex

    while index < source.endIndex {
      let character = source[index]

      if character.isWhitespace {
        index = source.index(after: index)
      } else if character.isASCII, character.isNumber || character == "." {
        guard let match = source[index...].prefixMatch(of: /(?:\d+\.?\d*|\.\d+)(?:[Ee][+-]?\d+)?/),
          let value = Double(match.output)
        else {
          return nil
        }

        tokens.append(.number(value))
        index = match.range.upperBound
      } else if character.isASCII, character.isLetter || character == "_" {
        let match = source[index...].prefixMatch(of: /[A-Z_a-z]\w*/)
        tokens.append(.identifier(String(match?.output ?? "")))
        index = match?.range.upperBound ?? source.index(after: index)
      } else if "(),*+/^-".contains(character) {
        tokens.append(.symbol(character))
        index = source.index(after: index)
      } else {
        return nil
      }
    }

    return tokens
  }

  // MARK: - Parsing and evaluating in one pass

  private struct Parser {
    let tokens: [Token]
    let variables: [String: Double]
    var index = 0

    var isAtEnd: Bool { index == tokens.count }

    private var current: Token? { index < tokens.count ? tokens[index] : nil }

    private mutating func take(_ symbol: Character) -> Bool {
      guard current == .symbol(symbol) else {
        return false
      }

      index += 1
      return true
    }

    mutating func additive(depth: Int) -> Double? {
      guard var value = multiplicative(depth: depth) else { return nil }

      while true {
        if take("+") {
          guard let right = multiplicative(depth: depth) else { return nil }
          value += right
        } else if take("-") {
          guard let right = multiplicative(depth: depth) else { return nil }
          value -= right
        } else {
          return value
        }
      }
    }

    private mutating func multiplicative(depth: Int) -> Double? {
      guard var value = unary(depth: depth) else { return nil }

      while true {
        if take("*") {
          guard let right = unary(depth: depth) else { return nil }
          value *= right
        } else if take("/") {
          guard let right = unary(depth: depth), right != 0 else { return nil }
          value /= right
        } else {
          return value
        }
      }
    }

    private mutating func unary(depth: Int) -> Double? {
      guard depth <= ActivityExpression.maxDepth else { return nil }

      if take("+") {
        return unary(depth: depth + 1)
      }

      if take("-") {
        return unary(depth: depth + 1).map { -$0 }
      }

      return power(depth: depth)
    }

    private mutating func power(depth: Int) -> Double? {
      guard let base = primary(depth: depth) else { return nil }

      guard take("^") else {
        return base
      }

      guard let exponent = unary(depth: depth + 1) else { return nil }
      let value = pow(base, exponent)
      return value.isFinite ? value : nil
    }

    private mutating func primary(depth: Int) -> Double? {
      switch current {
      case .number(let value):
        index += 1
        return value
      case .identifier(let name):
        index += 1
        return take("(") ? call(name.lowercased(), depth: depth + 1) : constant(name)
      case .symbol("("):
        index += 1
        guard let value = additive(depth: depth + 1), take(")") else { return nil }
        return value
      default:
        return nil
      }
    }

    private func constant(_ name: String) -> Double? {
      switch name {
      case "e": M_E
      case "pi": Double.pi
      default: ActivityExpression.functions[name.lowercased()] == nil ? variables[name] : nil
      }
    }

    private mutating func call(_ name: String, depth: Int) -> Double? {
      guard let function = ActivityExpression.functions[name] else { return nil }

      var arguments: [Double] = []

      if !take(")") {
        repeat {
          guard let argument = additive(depth: depth) else { return nil }
          arguments.append(argument)
        } while take(",")

        guard take(")") else { return nil }
      }

      guard arguments.count >= function.minArguments, arguments.count <= function.maxArguments
      else {
        return nil
      }

      let value = function.apply(arguments)
      return value.isFinite ? value : nil
    }
  }

  // MARK: - Functions

  private struct Function: Sendable {
    let minArguments: Int
    let maxArguments: Int
    let apply: @Sendable ([Double]) -> Double

    static func unary(_ apply: @escaping @Sendable (Double) -> Double) -> Function {
      Function(minArguments: 1, maxArguments: 1) { apply($0[0]) }
    }
  }

  private static let functions: [String: Function] = [
    "abs": .unary { Swift.abs($0) },
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
    "max": Function(minArguments: 1, maxArguments: .max) { $0.max() ?? .nan },
    "min": Function(minArguments: 1, maxArguments: .max) { $0.min() ?? .nan },
    "rad": .unary { $0 * .pi / 180 },
    "round": Function(minArguments: 1, maxArguments: 2) { arguments in
      let digits = arguments.count > 1 ? arguments[1] : 0

      guard digits.rounded() == digits, (0...10).contains(digits) else {
        return .nan
      }

      let factor = pow(10, digits)
      // JavaScript's Math.round rounds halves up, toward positive infinity.
      return (arguments[0] * factor + 0.5).rounded(.down) / factor
    },
    "sign": .unary { $0 == 0 ? 0 : $0 > 0 ? 1 : -1 },
    "sin": .unary(sin),
    "sqrt": .unary(sqrt),
    "tan": .unary(tan),
  ]
}
