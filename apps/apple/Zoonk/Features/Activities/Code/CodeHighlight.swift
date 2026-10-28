import SwiftUI

/// Colors code for reading, as main's `highlightCode`: keywords, built-ins, literals and comments.
/// It only needs to look right for short lesson programs, so it scans tokens without parsing the
/// language. Colors are main's palette by meaning (the design system's `viz` roles): keywords
/// mint, built-ins purple, numbers and strings orange, comments secondary and italic.
enum CodeHighlight {
  enum Language {
    case javascript, python, sql
  }

  enum Kind: Equatable {
    case builtin, comment, keyword, number, plain, string
  }

  /// The program's lines, each colored; a comment or string that spans lines colors each one.
  static func lines(of code: String, language: Language) -> [AttributedString] {
    tokenLines(of: code, language: language).map { tokens in
      tokens.reduce(into: AttributedString()) { line, token in
        line += styled(token.text, token.kind)
      }
    }
  }

  /// The whole program colored, its lines kept.
  static func text(of code: String, language: Language) -> AttributedString {
    lines(of: code, language: language).enumerated().reduce(into: AttributedString()) {
      text, line in
      text += line.offset == 0 ? line.element : AttributedString("\n") + line.element
    }
  }

  /// The program's tokens split at its line breaks.
  static func tokenLines(of code: String, language: Language) -> [[(kind: Kind, text: String)]] {
    var lines: [[(kind: Kind, text: String)]] = [[]]
    var rest = code[...]

    while !rest.isEmpty {
      let (kind, text) = token(at: rest, language: language)
      let parts = text.split(separator: "\n", omittingEmptySubsequences: false)

      for (index, part) in parts.enumerated() {
        if index > 0 {
          lines.append([])
        }

        if !part.isEmpty {
          lines[lines.count - 1].append((kind, String(part)))
        }
      }

      rest = rest[text.endIndex...]
    }

    return lines
  }

  private static func styled(_ text: String, _ kind: Kind) -> AttributedString {
    var part = AttributedString(text)

    switch kind {
    case .keyword:
      part.foregroundColor = .mint
    case .builtin:
      part.foregroundColor = .purple
    case .number, .string:
      part.foregroundColor = .orange
    case .comment:
      part.foregroundColor = .secondary
      part.inlinePresentationIntent = .emphasized
    case .plain:
      break
    }

    return part
  }

  /// The token at the start of `code`: the first rule that matches, else plain text.
  private static func token(at code: Substring, language: Language) -> (Kind, Substring) {
    if let space = match(space, in: code) {
      return (.plain, space)
    }

    for (kind, pattern) in rules(for: language) {
      if let text = match(pattern, in: code) {
        return (kind ?? wordKind(String(text), language: language), text)
      }
    }

    return (.plain, match(other, in: code) ?? code.prefix(1))
  }

  private static func match(_ pattern: Regex<AnyRegexOutput>, in code: Substring) -> Substring? {
    guard let found = try? pattern.prefixMatch(in: code), !found.range.isEmpty else {
      return nil
    }

    return code[found.range]
  }

  private static func wordKind(_ word: String, language: Language) -> Kind {
    switch language {
    case .sql:
      let lower = word.lowercased()
      return sqlKeywords.contains(lower)
        ? .keyword : sqlBuiltins.contains(lower) ? .builtin : .plain
    case .python:
      return pythonKeywords.contains(word)
        ? .keyword : pythonBuiltins.contains(word) ? .builtin : .plain
    case .javascript:
      return javascriptKeywords.contains(word)
        ? .keyword : javascriptBuiltins.contains(word) ? .builtin : .plain
    }
  }

  /// Each language's rules in order; a nil kind is a word, colored by `wordKind`.
  private static func rules(for language: Language) -> [(Kind?, Regex<AnyRegexOutput>)] {
    switch language {
    case .javascript: javascriptRules
    case .python: pythonRules
    case .sql: sqlRules
    }
  }

  // Regex isn't Sendable, but these are built once and never mutated: matching only reads them.
  nonisolated(unsafe) private static let number = pattern(
    #"(?i)0x[\da-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?"#)
  nonisolated(unsafe) private static let space = pattern(#"\s+"#)
  nonisolated(unsafe) private static let other = pattern(#"[^\s\w$"'`#/-]+|[\s\S]"#)

  nonisolated(unsafe) private static let javascriptRules: [(Kind?, Regex<AnyRegexOutput>)] = [
    (.comment, pattern(#"//[^\n]*|/\*[\s\S]*?(?:\*/|$)"#)),
    (.string, pattern(#""(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?"#)),
    (.number, number),
    (nil, pattern(#"[$A-Z_a-z][\w$]*"#)),
  ]

  nonisolated(unsafe) private static let pythonRules: [(Kind?, Regex<AnyRegexOutput>)] = [
    (.comment, pattern(#"#[^\n]*"#)),
    (
      .string,
      pattern(
        #"(?i)[bfr]{0,2}(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)"#
      )
    ),
    (.number, number),
    (nil, pattern(#"[A-Z_a-z]\w*"#)),
  ]

  nonisolated(unsafe) private static let sqlRules: [(Kind?, Regex<AnyRegexOutput>)] = [
    (.comment, pattern(#"--[^\n]*|/\*[\s\S]*?(?:\*/|$)"#)),
    (.string, pattern(#"'(?:''|[^'])*'?"#)),
    (.number, number),
    (nil, pattern(#"[A-Z_a-z]\w*"#)),
  ]

  private static func pattern(_ source: String) -> Regex<AnyRegexOutput> {
    // The patterns are literals above; one that doesn't compile is a programming error.
    try! Regex(source)
  }

  private static let javascriptKeywords: Set<String> = [
    "async", "await", "break", "case", "catch", "class", "const", "continue", "default", "delete",
    "do", "else", "export", "extends", "false", "finally", "for", "function", "if", "import", "in",
    "instanceof", "let", "new", "null", "of", "return", "switch", "this", "throw", "true", "try",
    "typeof", "undefined", "var", "while", "yield",
  ]

  private static let javascriptBuiltins: Set<String> = [
    "Array", "JSON", "Map", "Math", "Number", "Object", "Promise", "Set", "String", "console",
    "parseFloat", "parseInt", "setTimeout",
  ]

  private static let pythonKeywords: Set<String> = [
    "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class", "continue",
    "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import",
    "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while",
    "with", "yield",
  ]

  private static let pythonBuiltins: Set<String> = [
    "abs", "bool", "dict", "enumerate", "float", "input", "int", "len", "list", "max", "min",
    "print", "range", "reversed", "round", "set", "sorted", "str", "sum", "tuple", "zip",
  ]

  private static let sqlKeywords: Set<String> = [
    "all", "and", "as", "asc", "between", "by", "case", "desc", "distinct", "else", "end",
    "exists", "from", "group", "having", "in", "inner", "is", "join", "left", "like", "limit",
    "not", "null", "offset", "on", "or", "order", "outer", "select", "then", "union", "when",
    "where", "with",
  ]

  private static let sqlBuiltins: Set<String> = [
    "avg", "coalesce", "count", "length", "lower", "max", "min", "round", "substr", "sum", "upper",
  ]
}

extension CodeLanguage {
  var highlight: CodeHighlight.Language {
    switch self {
    case .javascript: .javascript
    case .python: .python
    }
  }
}
