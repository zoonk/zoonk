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
        ["csharp", "cs", "c#"],
        CodeSyntax(
          keywords: words(
            "abstract as async await base bool break byte case catch char class const continue decimal default do double else enum false finally float for foreach if in int interface internal is long namespace new null object out override params private protected public readonly record ref return sealed short static string struct switch this throw true try uint ulong using var virtual void while"
          ),
          builtins: words("Console Convert DateTime Dictionary Exception List Math String"),
          rules: [
            cLikeRules[0],
            Rule(kind: .string, pattern: #/[$@]{0,2}"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/#),
          ] + cLikeRules.dropFirst(2))
      ),
      (
        ["go", "golang"],
        CodeSyntax(
          keywords: words(
            "break case chan const continue default defer else fallthrough false for func go goto if import interface iota map nil package range return select struct switch true type var"
          ),
          builtins: words(
            "append bool byte cap close copy delete error float64 fmt int int64 len make math new panic recover rune sort strconv string strings"
          ),
          rules: [
            cLikeRules[0],
            Rule(kind: .string, pattern: #/"(?:\\.|[^"\\\n])*"?|`[^`]*`?|'(?:\\.|[^'\\\n])*'?/#),
          ] + cLikeRules.dropFirst(2))
      ),
      (
        ["rust", "rs"],
        CodeSyntax(
          keywords: words(
            "as break const continue crate dyn else enum false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while"
          ),
          builtins: words(
            "Box Err HashMap None Ok Option Result Some String Vec bool char eprintln f32 f64 format i32 i64 isize panic print println str u32 u64 u8 usize vec"
          ),
          rules: [
            cLikeRules[0],
            // A quote opens a char only when it closes one character later; otherwise it's a
            // lifetime (`'a`).
            Rule(kind: .string, pattern: #/"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])'/#),
          ] + cLikeRules.dropFirst(2))
      ),
      (
        ["swift"],
        CodeSyntax(
          keywords: words(
            "as break case catch class continue default defer do else enum extension false for func guard if import in init inout internal is let nil private protocol public repeat return self Self static struct switch throw throws true try var where while"
          ),
          builtins: words(
            "Array Bool Character Dictionary Double Float Int Set String abs max min print"),
          rules: [
            cLikeRules[0],
            Rule(kind: .string, pattern: #/"""[\s\S]*?(?:"""|$)|"(?:\\.|[^"\\\n])*"?/#),
          ] + cLikeRules.dropFirst(2))
      ),
      (
        ["kotlin", "kt", "kts"],
        CodeSyntax(
          keywords: words(
            "as break class companion continue data do else enum false for fun if import in interface internal is null object open override package private protected public return sealed super this throw true try val var when while"
          ),
          builtins: words(
            "Any Array Boolean Char Double Int List Long Map MutableList Set String Unit arrayOf listOf mapOf mutableListOf print println setOf"
          ),
          rules: [
            cLikeRules[0],
            Rule(
              kind: .string,
              pattern: #/"""[\s\S]*?(?:"""|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/#),
          ] + cLikeRules.dropFirst(2))
      ),
      (
        ["php"],
        CodeSyntax(
          keywords: words(
            "abstract and array as break case catch class const continue default do echo else elseif empty extends false final finally fn for foreach function global if implements instanceof interface isset match namespace new null or print private protected public readonly require return static switch throw trait true try unset use while yield"
          ),
          builtins: words(
            "array_filter array_map count explode implode in_array json_encode printf sprintf str_repeat strlen strtolower strtoupper var_dump"
          ),
          rules: [
            Rule(kind: .comment, pattern: #/\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?(?:\*\/|$)/#),
            Rule(kind: .keyword, pattern: /<\?php|\?>/),
          ] + cLikeRules.dropFirst())
      ),
      (
        ["ruby", "rb"],
        CodeSyntax(
          keywords: words(
            "alias and begin break case class def do else elsif end ensure false for if in module next nil not or redo rescue retry return self super then true undef unless until when while yield"
          ),
          builtins: words(
            "Array Float Hash Integer String attr_accessor attr_reader lambda p print proc puts raise require"
          ),
          rules: [Rule(kind: .comment, pattern: /#[^\n]*/)] + cLikeRules.dropFirst())
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
