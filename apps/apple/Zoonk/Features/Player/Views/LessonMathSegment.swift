import Foundation

/// A port of `splitAtMath` in `packages/utils/src/math-spans.ts`, which the lesson checks and every
/// player follow; `LessonMathSegmentTests` holds it to that file's fixture.
struct LessonMathSegment: Equatable {
  enum Kind: String {
    case text, math, displayMath
  }

  let kind: Kind
  let text: String

  static func split(_ line: String) -> [LessonMathSegment] {
    var segments: [LessonMathSegment] = []
    var rest = Array(line)

    while let span = MathSpan.first(in: rest) {
      if span.start > 0 {
        segments.append(LessonMathSegment(kind: .text, text: String(rest[..<span.start])))
      }

      segments.append(
        LessonMathSegment(kind: span.display ? .displayMath : .math, text: span.content))
      rest = Array(rest[span.end...])
    }

    if !rest.isEmpty {
      segments.append(LessonMathSegment(kind: .text, text: String(rest)))
    }

    return segments
  }
}

private struct MathSpan {
  let content: String
  let display: Bool
  let start: Int
  let end: Int

  /// JavaScript's `\s`, which the TypeScript finder uses; `Character.isWhitespace` also takes
  /// U+0085 and leaves out U+FEFF.
  private static let space = CharacterSet(
    charactersIn:
      "\t\n\u{0B}\u{0C}\r \u{A0}\u{1680}\u{2028}\u{2029}\u{202F}\u{205F}\u{3000}\u{FEFF}"
  )
  .union(CharacterSet(charactersIn: "\u{2000}"..."\u{200A}"))

  private static let brackets: [(open: [Character], close: [Character], display: Bool)] = [
    (Array(#"\\("#), Array(#"\\)"#), false),
    (Array(#"\\["#), Array(#"\\]"#), true),
    (Array(#"\("#), Array(#"\)"#), false),
    (Array(#"\["#), Array(#"\]"#), true),
  ]

  static func first(in text: [Character]) -> MathSpan? {
    let bracketed = brackets.compactMap { open, close, display -> MathSpan? in
      guard let start = text.firstIndex(of: open, from: 0),
        let end = text.firstIndex(of: close, from: start + open.count)
      else {
        return nil
      }

      return MathSpan(
        content: String(text[(start + open.count)..<end]), display: display, start: start,
        end: end + close.count)
    }

    return ([dollarMath(in: text, from: 0)].compactMap(\.self) + bracketed)
      .min { $0.start < $1.start }
  }

  private static func dollarMath(in text: [Character], from: Int) -> MathSpan? {
    guard let start = text[from...].firstIndex(of: "$") else {
      return nil
    }

    guard isDelimiter(text, start) else {
      return dollarMath(in: text, from: start + 1)
    }

    if text.starts(with: Array("$$"), at: start) {
      guard let close = text.firstIndex(of: Array("$$"), from: start + 2) else {
        return dollarMath(in: text, from: start + 1)
      }

      let content = String(text[(start + 2)..<close])
        .trimmingCharacters(in: space)

      return content.isEmpty
        ? dollarMath(in: text, from: close + 2)
        : MathSpan(content: content, display: true, start: start, end: close + 2)
    }

    return inlineMath(text, at: start) ?? dollarMath(in: text, from: start + 1)
  }

  private static func inlineMath(_ text: [Character], at start: Int) -> MathSpan? {
    guard !isWhitespace(text, start + 1), let close = inlineClose(text, from: start + 2) else {
      return nil
    }

    return MathSpan(
      content: String(text[(start + 1)..<close]), display: false, start: start, end: close + 1)
  }

  /// Inline math never holds an unescaped `$`: if the first one can't close it, the opener isn't
  /// math, so in "$5 and the gap is $10^{-5}$" the price stays text.
  private static func inlineClose(_ text: [Character], from: Int) -> Int? {
    guard from < text.count, let index = text[from...].firstIndex(of: "$") else {
      return nil
    }

    if isEscaped(text, index) {
      return inlineClose(text, from: index + 1)
    }

    let isClose =
      !isCurrencySign(text, index) && !isWhitespace(text, index - 1)
      && !isDigit(text, index + 1)

    return isClose ? index : nil
  }

  private static func isDelimiter(_ text: [Character], _ index: Int) -> Bool {
    !isEscaped(text, index) && !isCurrencySign(text, index)
  }

  private static func isEscaped(_ text: [Character], _ index: Int) -> Bool {
    index > 0 && text[index - 1] == "\\"
  }

  private static func isCurrencySign(_ text: [Character], _ index: Int) -> Bool {
    let before = index > 0 ? text[index - 1].unicodeScalars.first : nil
    let isAfterCapital = before?.properties.generalCategory == .uppercaseLetter
    let priceStart = isWhitespace(text, index + 1) ? index + 2 : index + 1
    return isAfterCapital && isDigit(text, priceStart)
  }

  private static func isWhitespace(_ text: [Character], _ index: Int) -> Bool {
    !text.indices.contains(index) || text[index].unicodeScalars.allSatisfy(space.contains)
  }

  private static func isDigit(_ text: [Character], _ index: Int) -> Bool {
    text.indices.contains(index) && ("0"..."9").contains(text[index])
  }
}

extension Array where Element == Character {
  fileprivate func firstIndex(of pattern: [Character], from: Int) -> Int? {
    guard from <= count - pattern.count else {
      return nil
    }

    return (from...(count - pattern.count)).first { starts(with: pattern, at: $0) }
  }

  fileprivate func starts(with pattern: [Character], at index: Int) -> Bool {
    index + pattern.count <= count && Array(self[index..<(index + pattern.count)]) == pattern
  }
}
