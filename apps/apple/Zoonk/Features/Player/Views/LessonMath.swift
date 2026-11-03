import SwiftUI
import UIKit

/// Main draws LaTeX with KaTeX; this sets it as text, as Android's `typesetMath` does, so it wraps
/// and scales with Dynamic Type. VoiceOver says it in the words the web and Android say: "x
/// squared", "1 over 4".
enum LessonMath {
  static func typeset(_ latex: String) -> RichInline {
    // Structured AI output can over-escape a command (`\\rightarrow`); main accepts it, so this does too.
    let source = latex.replacing(/\\\\[A-Za-z]+/) { $0.output.dropFirst() }
    var parser = Parser(source: Array(source))
    let piece = parser.parse(until: nil, style: .normal)

    return RichInline(
      text: piece.text,
      spoken: piece.spoken.split(whereSeparator: \.isWhitespace).joined(separator: " "))
  }

  fileprivate enum Style {
    case normal, superscript, `subscript`

    var baselineOffset: CGFloat {
      let offset = UIFontMetrics(forTextStyle: .body).scaledValue(for: 6)

      return switch self {
      case .normal: 0
      case .superscript: offset
      case .subscript: -offset / 1.5
      }
    }
  }

  fileprivate struct Piece {
    var text = AttributedString()
    var spoken = ""

    var said: String {
      spoken.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    static func + (lhs: Piece, rhs: Piece) -> Piece {
      Piece(text: lhs.text + rhs.text, spoken: lhs.spoken + rhs.spoken)
    }

    static func += (lhs: inout Piece, rhs: Piece) {
      lhs = lhs + rhs
    }
  }

  /// Marks that change what a letter means: a mean (x̄), a vector (v⃗), a rate of change (ẋ).
  fileprivate enum Accent: String {
    case bar, overline, vec, overrightarrow, hat, widehat, dot, tilde

    /// A combining mark after each character, so it sits over it.
    var mark: Character {
      switch self {
      case .bar: "\u{0304}"
      case .overline: "\u{0305}"
      case .vec, .overrightarrow: "\u{20D7}"
      case .hat, .widehat: "\u{0302}"
      case .dot: "\u{0307}"
      case .tilde: "\u{0303}"
      }
    }

    func spoken(_ base: String) -> String {
      switch self {
      case .bar, .overline: Words.bar(base)
      case .vec, .overrightarrow: Words.vector(base)
      case .hat, .widehat: Words.hat(base)
      case .dot: Words.dot(base)
      case .tilde: Words.tilde(base)
      }
    }
  }

  fileprivate struct Parser {
    let source: [Character]
    var index = 0

    mutating func parse(until end: Character?, style: Style) -> Piece {
      var result = Piece()

      while index < source.count {
        let character = source[index]

        if character == end {
          index += 1
          return result
        }

        if character == "\\" {
          result += spaced(command(style: style), after: result, style: style)
          continue
        }

        index += 1

        switch character {
        case "{":
          result += parse(until: "}", style: style)
        case "^", "_":
          result += script(style: character == "^" ? .superscript : .subscript)
        case "~":
          result += run(" ", style: style, italic: false)
        case "&":
          break
        case _ where Self.spaces.contains(character):
          break
        default:
          result += spaced(symbol(character, style: style), after: result, style: style)
        }
      }

      return result
    }

    /// A relation or operator, set apart by a space as KaTeX spaces `=` and `+` (not in an exponent
    /// or index). A sign that starts an expression or follows an operator, a bracket or a comma
    /// stays with its number: `−3`.
    private func spaced(_ piece: Piece, after result: Piece, style: Style) -> Piece {
      let text = String(piece.text.characters)
      let isBinary = Self.binaryOperators.contains(text)

      guard style == .normal, isBinary || Self.relations.contains(text) else {
        return piece
      }

      if isBinary, result.text.characters.last.map({ "\u{2005}([{,".contains($0) }) ?? true {
        return piece
      }

      let gap = Piece(text: run("\u{2005}", style: style, italic: false).text, spoken: " ")
      return gap + piece + gap
    }

    private mutating func script(style: Style) -> Piece {
      let piece = argument(style: style)
      let said = piece.said

      let spoken =
        if said.isEmpty || Self.attachedMarks.contains(said) {
          said
        } else if style == .subscript {
          " \(Words.sub(said)) "
        } else if said == "2" {
          " \(Words.squared) "
        } else if said == "3" {
          " \(Words.cubed) "
        } else {
          " \(Words.power(said)) "
        }

      return Piece(text: piece.text, spoken: spoken)
    }

    /// KaTeX skips the spaces before an argument: `x^ 2` is x².
    private mutating func argument(style: Style) -> Piece {
      skipSpaces()

      guard index < source.count else {
        return Piece()
      }

      let character = source[index]

      if character == "\\" {
        return command(style: style)
      }

      index += 1
      return character == "{" ? parse(until: "}", style: style) : symbol(character, style: style)
    }

    /// A root's optional index (`\sqrt[3]{8}`), set raised before the radical: ³√8.
    private mutating func rootIndex() -> Piece {
      skipSpaces()

      guard index < source.count, source[index] == "[" else {
        return Piece()
      }

      index += 1
      return parse(until: "]", style: .superscript)
    }

    private mutating func textArgument() -> String {
      skipSpaces()

      guard index < source.count, source[index] == "{" else {
        return ""
      }

      index += 1
      var depth = 1
      var text = ""

      while index < source.count {
        let character = source[index]
        index += 1

        if character == "{" {
          depth += 1
        } else if character == "}" {
          depth -= 1

          if depth == 0 {
            break
          }
        }

        text.append(character)
      }

      return text.replacingOccurrences(of: "\\", with: "")
    }

    private mutating func skipSpaces() {
      while index < source.count, Self.spaces.contains(source[index]) {
        index += 1
      }
    }

    private mutating func command(style: Style) -> Piece {
      index += 1
      var name = ""

      while index < source.count, source[index].isLetter {
        name.append(source[index])
        index += 1
      }

      if name.isEmpty {
        return escaped(style: style)
      }

      if let accent = Accent(rawValue: name) {
        let base = argument(style: style)
        return Piece(
          text: accented(base.text, with: accent.mark), spoken: " \(accent.spoken(base.said)) ")
      }

      if Self.functions.contains(name) {
        return function(name, style: style)
      }

      switch name {
      case "text", "mathrm", "textrm", "operatorname", "mbox", "textnormal":
        return run(textArgument(), style: style, italic: false)
      case "mathit", "textit", "emph":
        return styled(argument(style: style), .emphasized)
      case "mathbf", "textbf", "boldsymbol", "bm":
        return styled(argument(style: style), .stronglyEmphasized)
      case "mathbb":
        let letters = textArgument().map { Self.doubleStruck[$0] ?? $0 }
        return run(String(letters), style: style, italic: false)
      case "mathcal", "mathsf", "mathtt", "mathscr":
        return argument(style: style)
      case "underline":
        var underlined = argument(style: style)
        underlined.text[AttributeScopes.SwiftUIAttributes.UnderlineStyleAttribute.self] = .single
        return underlined
      case "frac", "dfrac", "tfrac":
        let numerator = argument(style: .superscript)
        let denominator = argument(style: .subscript)
        let slash = run("\u{2044}", style: style, italic: false)

        return Piece(
          text: (numerator + slash + denominator).text,
          spoken: " \(Words.fraction(numerator.said, denominator.said)) ")
      case "sqrt":
        return root(style: style)
      case "begin", "end":
        _ = textArgument()
        return Piece()
      case "left", "right", "big", "Big", "bigl", "bigr", "Bigl", "Bigr", "displaystyle",
        "textstyle", "limits":
        return Piece()
      case "quad", "qquad":
        return run("  ", style: style, italic: false)
      default:
        return run(Self.symbols[name] ?? name, style: style, italic: false)
      }
    }

    /// An escaped character (`\$`, `\%`, `\{`) or a spacing command (`\,`, `\;`, `\ `).
    private mutating func escaped(style: Style) -> Piece {
      guard index < source.count else {
        return Piece()
      }

      let character = source[index]
      index += 1

      return switch character {
      case "!": Piece()
      case ",", ";", ":", " ", "\\": run(" ", style: style, italic: false)
      default: run(String(character), style: style, italic: false)
      }
    }

    private mutating func root(style: Style) -> Piece {
      let rootIndex = rootIndex()
      let radicand = argument(style: style)
      let radical = rootIndex + run("√", style: style, italic: false)

      let text =
        radicand.text.characters.count > 1
        ? radical + run("(", style: style, italic: false) + radicand
          + run(")", style: style, italic: false)
        : radical + radicand

      let spoken =
        switch rootIndex.said {
        case "", "2": Words.root(radicand.said)
        case "3": Words.cubeRoot(radicand.said)
        default: Words.nthRoot(rootIndex.said, radicand.said)
        }

      return Piece(text: text.text, spoken: " \(spoken) ")
    }

    /// KaTeX sets a thin space between a function and what it applies to: "sin x", but "sin(x)".
    private func function(_ name: String, style: Style) -> Piece {
      let next = source[index...].first { !Self.spaces.contains($0) }
      let piece = run(name, style: style, italic: false)

      guard let next, next.isLetter || next.isNumber || next == "\\" || next == "{" else {
        return piece
      }

      return piece + Piece(text: run("\u{2006}", style: style, italic: false).text, spoken: " ")
    }

    private func symbol(_ character: Character, style: Style) -> Piece {
      run(
        character == "-" ? "\u{2212}" : String(character), style: style, italic: character.isLetter)
    }

    private func run(_ text: String, style: Style, italic: Bool) -> Piece {
      var run = AttributedString(text)

      if style == .normal {
        run.inlinePresentationIntent = italic ? .emphasized : nil
      } else {
        // SwiftUI's own keys, which `Text` reads (UIKit has same-named ones it ignores).
        run[AttributeScopes.SwiftUIAttributes.FontAttribute.self] =
          italic ? .caption.italic() : .caption
        run[AttributeScopes.SwiftUIAttributes.BaselineOffsetAttribute.self] = style.baselineOffset
      }

      return Piece(text: run, spoken: Self.spokenSymbols[text] ?? text)
    }

    private func styled(_ piece: Piece, _ intent: InlinePresentationIntent) -> Piece {
      var styled = piece
      styled.text.inlinePresentationIntent = intent
      return styled
    }

    private func accented(_ text: AttributedString, with mark: Character) -> AttributedString {
      text.runs.reduce(into: AttributedString()) { result, run in
        let marked = text[run.range].characters.map { "\($0)\(mark)" }.joined()
        result += AttributedString(marked, attributes: run.attributes)
      }
    }

    static let spaces: Set<Character> = [" ", "\t", "\n", "\r", "\r\n"]

    static let relations: Set<String> = [
      "=", "<", ">", "≤", "≥", "≠", "≈", "≡", "∼", "≃", "≅", "∝", "→", "←", "↔", "⇒", "⇐", "⇔", "↦",
      "∈", "∉", "⊂", "⊆", "≪", "≫", "⩽", "⩾",
    ]
    static let binaryOperators: Set<String> = [
      "+", "\u{2212}", "×", "÷", "·", "±", "∓", "∪", "∩", "∗", "⋆",
    ]

    /// Marks an exponent attaches to its base, said as themselves ("90°", "f′").
    static let attachedMarks: Set<String> = ["°", "′", "″", "∗", "*"]

    /// A middle dot between numbers multiplies them: "times".
    static let spokenSymbols: [String: String] = ["·": "×"]

    static let functions: Set<String> = [
      "log", "ln", "lg", "sin", "cos", "tan", "sec", "csc", "cot", "arcsin", "arccos", "arctan",
      "sinh", "cosh", "tanh", "exp", "min", "max", "lim", "det", "gcd", "deg", "sup", "inf", "arg",
    ]

    static let doubleStruck: [Character: Character] = [
      "R": "ℝ", "N": "ℕ", "Z": "ℤ", "Q": "ℚ", "C": "ℂ",
    ]

    static let symbols: [String: String] = [
      "times": "×", "cdot": "·", "cdotp": "·", "div": "÷", "pm": "±", "mp": "∓", "ast": "∗",
      "star": "⋆", "leq": "≤", "le": "≤", "leqslant": "⩽", "geq": "≥", "ge": "≥", "geqslant": "⩾",
      "lt": "<", "gt": ">", "neq": "≠", "ne": "≠", "approx": "≈", "equiv": "≡", "sim": "∼",
      "simeq": "≃", "cong": "≅", "propto": "∝", "ll": "≪", "gg": "≫", "infty": "∞", "to": "→",
      "rightarrow": "→", "leftarrow": "←", "leftrightarrow": "↔", "uparrow": "↑", "downarrow": "↓",
      "mapsto": "↦", "Rightarrow": "⇒", "Leftarrow": "⇐", "Leftrightarrow": "⇔", "implies": "⇒",
      "iff": "⇔", "sum": "∑", "prod": "∏", "int": "∫", "oint": "∮", "partial": "∂", "nabla": "∇",
      "circ": "°", "degree": "°", "angle": "∠", "triangle": "△", "square": "□", "perp": "⊥",
      "parallel": "∥", "mid": "∣", "in": "∈", "notin": "∉", "subset": "⊂", "subseteq": "⊆",
      "cup": "∪", "cap": "∩", "emptyset": "∅", "varnothing": "∅", "forall": "∀", "exists": "∃",
      "neg": "¬", "land": "∧", "lor": "∨", "ldots": "…", "cdots": "⋯", "dots": "…", "colon": ":",
      "percent": "%", "prime": "′", "checkmark": "✓", "ell": "ℓ", "hbar": "ℏ", "alpha": "α",
      "beta": "β", "gamma": "γ", "delta": "δ", "epsilon": "ε", "varepsilon": "ε", "zeta": "ζ",
      "eta": "η", "theta": "θ", "vartheta": "ϑ", "iota": "ι", "kappa": "κ", "lambda": "λ",
      "mu": "μ", "nu": "ν", "xi": "ξ", "pi": "π", "rho": "ρ", "varrho": "ϱ", "sigma": "σ",
      "tau": "τ", "upsilon": "υ", "phi": "φ", "varphi": "φ", "chi": "χ", "psi": "ψ", "omega": "ω",
      "Gamma": "Γ", "Delta": "Δ", "Theta": "Θ", "Lambda": "Λ", "Xi": "Ξ", "Pi": "Π", "Sigma": "Σ",
      "Upsilon": "Υ", "Phi": "Φ", "Psi": "Ψ", "Omega": "Ω",
    ]
  }

  /// The words the web and Android say for a formula's structure, with their English and comments,
  /// so the translation step reuses their translations.
  fileprivate enum Words {
    static var squared: String {
      String(
        localized: "squared", table: "Player",
        comment: "Screen reader words for a formula, said after its base: \"x squared\".")
    }

    static var cubed: String {
      String(
        localized: "cubed", table: "Player",
        comment: "Screen reader words for a formula, said after its base: \"x cubed\".")
    }

    static func power(_ exponent: String) -> String {
      String(
        localized: "to the power of \(exponent)", table: "Player",
        comment:
          "Screen reader words for an exponent, said after its base: \"2 to the power of 10\".")
    }

    static func sub(_ index: String) -> String {
      String(
        localized: "sub \(index)", table: "Player",
        comment: "Screen reader words for an index, said after its base: \"x sub 1\".")
    }

    static func fraction(_ numerator: String, _ denominator: String) -> String {
      String(
        localized: "\(numerator) over \(denominator)", table: "Player",
        comment: "Screen reader words for a fraction: \"1 over 4\".")
    }

    static func root(_ radicand: String) -> String {
      String(
        localized: "square root of \(radicand)", table: "Player",
        comment: "Screen reader words for a square root: \"square root of 2\".")
    }

    static func cubeRoot(_ radicand: String) -> String {
      String(
        localized: "cube root of \(radicand)", table: "Player",
        comment: "Screen reader words for a cube root: \"cube root of 8\".")
    }

    static func nthRoot(_ index: String, _ radicand: String) -> String {
      String(
        localized: "\(index)th root of \(radicand)", table: "Player",
        comment:
          "Screen reader words for a root with an index other than 2 or 3; {index} is a number such as 4 or a letter such as n: \"4th root of 16\", \"nth root of x\"."
      )
    }

    static func bar(_ base: String) -> String {
      String(
        localized: "\(base) bar", table: "Player",
        comment:
          "Screen reader words for a letter with a bar over it, such as a mean: \"x bar\".")
    }

    static func dot(_ base: String) -> String {
      String(
        localized: "\(base) dot", table: "Player",
        comment:
          "Screen reader words for a letter with a dot over it, a rate of change in physics: \"x dot\"."
      )
    }

    static func hat(_ base: String) -> String {
      String(
        localized: "\(base) hat", table: "Player",
        comment:
          "Screen reader words for a letter with a hat over it, such as an estimate: \"p hat\".")
    }

    static func tilde(_ base: String) -> String {
      String(
        localized: "\(base) tilde", table: "Player",
        comment: "Screen reader words for a letter with a tilde over it: \"x tilde\".")
    }

    static func vector(_ base: String) -> String {
      String(
        localized: "vector \(base)", table: "Player",
        comment: "Screen reader words for a letter with an arrow over it, a vector: \"vector v\".")
    }
  }
}
