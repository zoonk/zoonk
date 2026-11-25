import Foundation

/// Main's `highlightCode`. It only needs to look right for the short programs lessons show, so it
/// scans tokens without parsing the language.
enum CodeHighlight {
  enum Kind: Equatable {
    case builtin, comment, keyword, number, plain, string
  }

  struct Token: Equatable {
    let kind: Kind
    var text: String
  }

  /// The program's lines, each as its colored runs, with every character kept as written; a comment
  /// or string that spans lines colors its part on each. `language` is a fence's name for it, such
  /// as `py`, or nil when it has none.
  static func lines(of code: String, language: String?) -> [[Token]] {
    let key = "\(language ?? "")\n\(code)" as NSString

    if let cached = cache.object(forKey: key) {
      return cached.lines
    }

    let lines = split(tokens(of: code, in: CodeSyntax.named(language)))
    cache.setObject(Lines(lines), forKey: key)
    return lines
  }

  private static func tokens(of code: String, in language: CodeSyntax) -> [Token] {
    var tokens: [Token] = []
    var index = code.startIndex

    while index < code.endIndex {
      let token = token(in: code, at: index, language: language)

      if tokens.last?.kind == token.kind {
        tokens[tokens.count - 1].text += token.text
      } else {
        tokens.append(token)
      }

      index = code.index(index, offsetBy: token.text.count)
    }

    return tokens
  }

  private static func token(in code: String, at index: String.Index, language: CodeSyntax)
    -> Token
  {
    let rest = code[index...]

    if let space = match(space, in: rest) {
      return Token(kind: .plain, text: space)
    }

    let before = index > code.startIndex ? code[code.index(before: index)] : nil
    let twoBefore =
      index > code.index(after: code.startIndex) ? code[code.index(index, offsetBy: -2)] : nil

    for rule in language.rules where rule.follows(before, twoBefore) {
      if let text = match(rule.pattern, in: rest) {
        return Token(
          kind: rule.kind ?? wordKind(text, after: before, in: language), text: text)
      }
    }

    return Token(kind: .plain, text: String(rest.prefix(1)))
  }

  private static func match(_ pattern: Regex<Substring>, in code: Substring) -> String? {
    guard let found = try? pattern.prefixMatch(in: code), !found.output.isEmpty else {
      return nil
    }

    return String(found.output)
  }

  /// A name after a dot is a property (`console.log`, `user.type`), never a keyword.
  private static func wordKind(_ word: String, after before: Character?, in language: CodeSyntax)
    -> Kind
  {
    let name = language.ignoresCase ? word.lowercased() : word

    if before == "." {
      return .plain
    }

    return language.keywords.contains(name)
      ? .keyword : language.builtins.contains(name) ? .builtin : .plain
  }

  private static func split(_ tokens: [Token]) -> [[Token]] {
    var lines: [[Token]] = [[]]

    for token in tokens {
      for (index, part) in token.text.split(separator: "\n", omittingEmptySubsequences: false)
        .enumerated()
      {
        if index > 0 {
          lines.append([])
        }

        if !part.isEmpty {
          lines[lines.count - 1].append(Token(kind: token.kind, text: String(part)))
        }
      }
    }

    return lines
  }

  // Regex isn't Sendable, but this is built once and never mutated: matching only reads it.
  nonisolated(unsafe) private static let space = /\s+/

  /// Lessons show the same few programs on every visit, and a screen draws them again whenever it
  /// changes.
  nonisolated(unsafe) private static let cache = NSCache<NSString, Lines>()

  private final class Lines {
    let lines: [[Token]]

    init(_ lines: [[Token]]) {
      self.lines = lines
    }
  }
}

/// Main's `code-languages`: the languages lessons write, under the names writers put after a
/// fence's backticks.
struct CodeSyntax {
  struct Rule {
    /// Nil for a word, looked up in the language's keywords and built-ins.
    let kind: CodeHighlight.Kind?
    let pattern: Regex<Substring>
    /// Main's lookbehind: whether the rule applies after these characters, the nearest first.
    var follows: (Character?, Character?) -> Bool = { _, _ in true }
  }

  var keywords: Set<String> = []
  var builtins: Set<String> = []
  var ignoresCase = false
  let rules: [Rule]

  static func named(_ name: String?) -> CodeSyntax {
    byName[name?.lowercased() ?? ""] ?? unknown
  }

  // Regex isn't Sendable, but these are built once and never mutated: matching only reads them.
  nonisolated(unsafe) private static let number =
    /0x[0-9a-f]+|[0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?/.ignoresCase()
  nonisolated(unsafe) private static let word = /[$\p{L}_][\p{L}\p{N}_$]*/
  nonisolated(unsafe) private static let slashComment = #/\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/#
  /// A string the learner hasn't closed yet still colors to the line's end, as an editor does.
  nonisolated(unsafe) private static let quoted = #/"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/#

  nonisolated(unsafe) private static let javascriptRules: [Rule] = [
    Rule(kind: .comment, pattern: slashComment),
    Rule(
      kind: .string, pattern: #/"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?/#),
    Rule(kind: .number, pattern: number),
    Rule(kind: nil, pattern: word),
  ]

  /// C-like languages with a string in either quote (a `char` in Java and C).
  nonisolated(unsafe) private static let cLikeRules: [Rule] = [
    Rule(kind: .comment, pattern: slashComment),
    Rule(kind: .string, pattern: quoted),
    Rule(kind: .number, pattern: number),
    Rule(kind: nil, pattern: word),
  ]

  private static let javascriptKeywords =
    "async await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield"

  private static let javascriptBuiltins =
    "Array Boolean Date Error JSON Map Math Number Object Promise Set String console document fetch parseFloat parseInt setInterval setTimeout window"

  nonisolated(unsafe) private static let languages: [(names: [String], language: CodeSyntax)] =
    [
      (
        ["javascript", "js", "jsx", "mjs", "cjs", "node"],
        CodeSyntax(
          keywords: words(javascriptKeywords), builtins: words(javascriptBuiltins),
          rules: javascriptRules)
      ),
      (
        ["typescript", "ts", "tsx", "mts", "cts"],
        CodeSyntax(
          keywords: words(
            javascriptKeywords
              + " abstract as declare enum implements interface keyof namespace private protected public readonly satisfies type"
          ),
          builtins: words(
            javascriptBuiltins
              + " Partial Readonly Record any boolean never number object string unknown"),
          rules: javascriptRules)
      ),
      (
        ["python", "py", "python3", "py3"],
        CodeSyntax(
          keywords: words(
            "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield"
          ),
          builtins: words(
            "abs bool dict enumerate float input int len list map max min open print range reversed round self set sorted str sum tuple type zip"
          ),
          rules: [
            Rule(kind: .comment, pattern: /#[^\n]*/),
            Rule(
              kind: .string,
              pattern:
                #/[bfr]{0,2}(?:"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)/#
                .ignoresCase()),
            Rule(kind: .number, pattern: number),
            Rule(kind: nil, pattern: word),
          ])
      ),
      (
        ["sql", "postgres", "postgresql", "mysql", "sqlite", "mariadb"],
        CodeSyntax(
          keywords: words(
            "all alter and as asc between by case create cross delete desc distinct drop else end exists false foreign from full group having in index inner insert into is join key left like limit not null offset on or order outer primary references right select set table then true union update values view when where with"
          ),
          builtins: words(
            "abs acos acosh asin asinh atan atan2 atanh avg ceil ceiling coalesce cos cosh count degrees exp floor length ln log log10 log2 lower max min mod now pi pow power radians round sign sin sinh sqrt substr sum tan tanh trunc upper"
          ),
          ignoresCase: true,
          rules: [
            Rule(kind: .comment, pattern: #/--[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/#),
            Rule(kind: .string, pattern: /'(?:''|[^'])*'?/),
            Rule(kind: .number, pattern: number),
            Rule(kind: nil, pattern: word),
          ])
      ),
      (
        ["java"],
        CodeSyntax(
          keywords: words(
            "abstract boolean break byte case catch char class continue default do double else enum extends false final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws true try var void while"
          ),
          builtins: words("ArrayList HashMap Integer List Map Math Object Scanner String System"),
          rules: cLikeRules)
      ),
      (
        // C and C++ in one: a C program rarely names anything after a C++ keyword.
        ["c", "h", "cpp", "c++", "cc", "cxx", "hpp"],
        CodeSyntax(
          keywords: words(
            "auto bool break case catch char class const continue default delete do double else enum extern false float for if int long namespace new nullptr private protected public return short signed sizeof static struct switch template this throw true try typedef union unsigned using virtual void while"
          ),
          builtins: words("NULL cin cout endl free malloc printf puts scanf std strlen"),
          rules: [cLikeRules[0], Rule(kind: .keyword, pattern: /#[ \t]*[a-z]+/)]
            + cLikeRules.dropFirst())
      ),
      (
        ["html", "htm", "xml", "svg"],
        CodeSyntax(rules: [
          Rule(kind: .comment, pattern: /<!--[\s\S]*?(?:-->|$)/),
          Rule(kind: .keyword, pattern: /[A-Za-z][A-Za-z0-9_:.-]*/) { before, twoBefore in
            before == "<" || (before == "/" && twoBefore == "<")
          },
          Rule(kind: .string, pattern: /"[^"\n]*"?|'[^'\n]*'?/) { before, _ in before == "=" },
          Rule(kind: nil, pattern: word),
        ])
      ),
      (
        ["css", "scss", "less"],
        CodeSyntax(rules: [
          Rule(kind: .comment, pattern: #/\/\*[\s\S]*?(?:\*\/|$)/#),
          Rule(kind: .string, pattern: quoted),
          Rule(kind: .keyword, pattern: /@[A-Za-z0-9_-]+/),
          Rule(
            kind: .number,
            pattern: /-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:%|[a-z]+)?/.ignoresCase()),
          Rule(kind: nil, pattern: /[\p{L}_-][\p{L}\p{N}_-]*/),
        ])
      ),
      // Program output and other text shown as written, with nothing colored.
      (["text", "txt", "plaintext", "plain", "output", "console", "log"], CodeSyntax(rules: [])),
    ]

  /// A language we don't know, or a fence with none: only what reads the same in most languages. A
  /// comment needs its marker at a word's start and a space after `#` or `--` (`#include`, `x--`
  /// and a URL's `//` stay plain), and a quote right after a letter is an apostrophe, not a string.
  nonisolated(unsafe) private static let unknown = CodeSyntax(rules: [
    Rule(kind: .comment, pattern: #/\/\/[^\n]*/#) { before, _ in before != ":" },
    Rule(kind: .comment, pattern: #/\/\*[\s\S]*?(?:\*\/|$)/#),
    Rule(kind: .comment, pattern: /(?:#|--)(?=[ \t])[^\n]*/) { before, _ in
      before?.isWhitespace ?? true
    },
    Rule(kind: .string, pattern: #/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/#) { before, _ in
      !(before?.isLetter ?? false) && !(before?.isNumber ?? false)
    },
    Rule(kind: .number, pattern: number),
    Rule(kind: nil, pattern: word),
  ])

  nonisolated(unsafe) private static let byName: [String: CodeSyntax] = Dictionary(
    languages.flatMap { entry in entry.names.map { ($0, entry.language) } },
    uniquingKeysWith: { first, _ in first })

  private static func words(_ list: String) -> Set<String> {
    Set(list.split(separator: " ").map(String.init))
  }
}
