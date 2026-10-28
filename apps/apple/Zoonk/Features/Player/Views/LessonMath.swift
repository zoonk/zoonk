import SwiftUI
import UIKit

/// Typesets the LaTeX lessons write (main draws it with KaTeX) as text: variables in italics,
/// exponents raised and indices lowered in a smaller size, fractions as a raised numerator over a
/// fraction slash and a lowered denominator, roots, `\text{}` upright, and symbols as their
/// characters. It stays text, so it wraps, scales with Dynamic Type and reads aloud.
enum LessonMath {
  static func attributed(_ latex: String) -> AttributedString {
    var parser = Parser(source: Array(latex))
    return parser.parse(until: nil, style: .normal)
  }

  fileprivate enum Style {
    case normal, superscript, `subscript`

    /// How far a raised or lowered run sits from the baseline, scaled with Dynamic Type.
    var baselineOffset: CGFloat {
      let offset = UIFontMetrics(forTextStyle: .body).scaledValue(for: 6)

      return switch self {
      case .normal: 0
      case .superscript: offset
      case .subscript: -offset / 1.5
      }
    }
  }

  fileprivate struct Parser {
    let source: [Character]
    var index = 0

    mutating func parse(until end: Character?, style: Style) -> AttributedString {
      var result = AttributedString()

      while index < source.count {
        let character = source[index]

        if character == end {
          index += 1
          return result
        }

        switch character {
        case "\\":
          result += spaced(command(style: style), after: result, style: style)
        case "{":
          index += 1
          result += parse(until: "}", style: style)
        case "^", "_":
          index += 1
          result += script(style: character == "^" ? .superscript : .subscript)
        case " ":
          index += 1
        default:
          index += 1
          let text = character == "-" ? "\u{2212}" : String(character)
          result += spaced(
            run(text, style: style, italic: character.isLetter), after: result, style: style)
        }
      }

      return result
    }

    /// A relation or operator, set apart by a space as KaTeX spaces `=` and `+` (not in an exponent
    /// or index). A sign that starts an expression or follows an operator, a bracket or a comma
    /// stays with its number: `−3`.
    private func spaced(_ piece: AttributedString, after result: AttributedString, style: Style)
      -> AttributedString
    {
      let text = String(piece.characters)
      let isBinary = Self.binaryOperators.contains(text)

      guard style == .normal, isBinary || Self.relations.contains(text) else {
        return piece
      }

      if isBinary, result.characters.last.map({ "\u{2005}([{,".contains($0) }) ?? true {
        return piece
      }

      let space = run("\u{2005}", style: style, italic: false)
      return space + piece + space
    }

    /// The group or single token after `^` or `_`.
    private mutating func script(style: Style) -> AttributedString {
      guard index < source.count else {
        return AttributedString()
      }

      if source[index] == "{" {
        index += 1
        return parse(until: "}", style: style)
      }

      if source[index] == "\\" {
        return command(style: style)
      }

      let character = source[index]
      index += 1
      return run(String(character), style: style, italic: character.isLetter)
    }

    /// A `{…}` argument, or the next single token.
    private mutating func argument(style: Style) -> AttributedString {
      while index < source.count, source[index] == " " {
        index += 1
      }

      return script(style: style)
    }

    /// A `{…}` argument read as plain text (`\text{…}`).
    private mutating func textArgument() -> String {
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

    private mutating func command(style: Style) -> AttributedString {
      index += 1
      var name = ""

      while index < source.count, source[index].isLetter {
        name.append(source[index])
        index += 1
      }

      if name.isEmpty, index < source.count {
        // An escaped character (`\$`, `\%`, `\{`) or a spacing command (`\,`, `\;`, `\ `).
        let character = source[index]
        index += 1
        return run(
          ",; !".contains(character) ? " " : String(character), style: style, italic: false)
      }

      switch name {
      case "text", "mathrm", "textrm", "operatorname", "mbox":
        return run(textArgument(), style: style, italic: false)
      case "mathbf", "textbf", "boldsymbol":
        var bold = argument(style: style)
        bold.inlinePresentationIntent = .stronglyEmphasized
        return bold
      case "frac", "dfrac", "tfrac":
        let numerator = argument(style: .superscript)
        let denominator = argument(style: .subscript)
        return numerator + run("\u{2044}", style: style, italic: false) + denominator
      case "sqrt":
        let radicand = argument(style: style)
        let needsParentheses = radicand.characters.count > 1
        return run("√", style: style, italic: false)
          + (needsParentheses
            ? run("(", style: style, italic: false) + radicand
              + run(")", style: style, italic: false)
            : radicand)
      case "left", "right", "big", "Big", "bigl", "bigr", "displaystyle", "limits":
        return AttributedString()
      case "quad", "qquad":
        return run("  ", style: style, italic: false)
      default:
        return run(Self.symbols[name] ?? name, style: style, italic: false)
      }
    }

    /// Text at the surrounding size; an exponent or index a step smaller, off the baseline.
    private func run(_ text: String, style: Style, italic: Bool) -> AttributedString {
      var run = AttributedString(text)

      if style == .normal {
        run.inlinePresentationIntent = italic ? .emphasized : nil
      } else {
        // SwiftUI's own keys, which `Text` reads (UIKit has same-named ones it ignores).
        run[AttributeScopes.SwiftUIAttributes.FontAttribute.self] =
          italic ? .caption.italic() : .caption
        run[AttributeScopes.SwiftUIAttributes.BaselineOffsetAttribute.self] = style.baselineOffset
      }

      return run
    }

    static let relations: Set<String> = [
      "=", "<", ">", "≤", "≥", "≠", "≈", "≡", "∼", "∝", "→", "←", "⇒", "⇐", "⇔", "∈", "∉", "⊂",
      "⊆",
    ]
    static let binaryOperators: Set<String> = ["+", "\u{2212}", "×", "÷", "·", "±", "∓", "∪", "∩"]

    static let symbols: [String: String] = [
      "times": "×", "cdot": "·", "div": "÷", "pm": "±", "mp": "∓", "leq": "≤", "le": "≤",
      "geq": "≥", "ge": "≥", "neq": "≠", "ne": "≠", "approx": "≈", "equiv": "≡", "sim": "∼",
      "propto": "∝", "infty": "∞", "to": "→", "rightarrow": "→", "leftarrow": "←",
      "Rightarrow": "⇒", "Leftarrow": "⇐", "Leftrightarrow": "⇔", "implies": "⇒", "iff": "⇔",
      "sum": "∑", "prod": "∏", "int": "∫", "partial": "∂", "nabla": "∇", "circ": "°",
      "degree": "°", "angle": "∠", "perp": "⊥", "parallel": "∥", "in": "∈", "notin": "∉",
      "subset": "⊂", "subseteq": "⊆", "cup": "∪", "cap": "∩", "emptyset": "∅", "forall": "∀",
      "exists": "∃", "neg": "¬", "land": "∧", "lor": "∨", "ldots": "…", "cdots": "⋯", "dots": "…",
      "percent": "%", "prime": "′", "alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ",
      "epsilon": "ε", "varepsilon": "ε", "zeta": "ζ", "eta": "η", "theta": "θ", "lambda": "λ",
      "mu": "μ", "nu": "ν", "xi": "ξ", "pi": "π", "rho": "ρ", "sigma": "σ", "tau": "τ",
      "phi": "φ", "varphi": "φ", "chi": "χ", "psi": "ψ", "omega": "ω", "Gamma": "Γ",
      "Delta": "Δ", "Theta": "Θ", "Lambda": "Λ", "Pi": "Π", "Sigma": "Σ", "Phi": "Φ",
      "Psi": "Ψ", "Omega": "Ω", "log": "log", "ln": "ln", "sin": "sin", "cos": "cos",
      "tan": "tan", "exp": "exp", "min": "min", "max": "max", "lim": "lim",
    ]
  }
}
