import Foundation

/// Main's `readCodeLine`: a line of code as a screen reader says it, its indentation apart from
/// its code.
struct SpokenCodeLine: Equatable {
  struct Run: Equatable {
    let count: Int
    let isTab: Bool
  }

  let code: String
  let indent: [Run]

  init(_ line: some StringProtocol) {
    let indentation = line.prefix { $0 == " " || $0 == "\t" }
    var code = String(line.dropFirst(indentation.count))

    while code.last?.isWhitespace == true {
      code.removeLast()
    }

    var runs: [Run] = []

    for character in indentation {
      let isTab = character == "\t"

      if let last = runs.last, last.isTab == isTab {
        runs[runs.count - 1] = Run(count: last.count + 1, isTab: isTab)
      } else {
        runs.append(Run(count: 1, isTab: isTab))
      }
    }

    self.code = code
    self.indent = code.isEmpty ? [] : runs
  }
}

/// Main's `useSpokenCode`: code in words VoiceOver keeps apart, a line's number and its
/// indentation, which the eye reads from where its code starts. Without them, a program whose
/// `print` is indented under its `for` and one where it isn't read the same.
enum SpokenCode {
  static func line(_ text: some StringProtocol, number: Int) -> String {
    let line = SpokenCodeLine(text)
    let code = line.code

    if code.isEmpty {
      return String(
        localized: "Line \(number): blank", table: "DesignSystem",
        locale: .appLanguage, comment: "Read by screen readers for an empty line of a program.")
    }

    if line.indent.isEmpty {
      return String(
        localized: "Line \(number): \(code)", table: "DesignSystem",
        locale: .appLanguage,
        comment:
          "Read by screen readers for a line of a program: its number, then its code as written.")
    }

    let indent = words(line.indent)

    return String(
      localized: "Line \(number), indented \(indent): \(code)", table: "DesignSystem",
      locale: .appLanguage,
      comment:
        "Read by screen readers for an indented line of a program: its number, how far it's indented (such as “4 spaces”), then its code as written."
    )
  }

  /// Code the learner presses, such as an answer option: one line reads as written.
  static func snippet(_ code: String) -> String {
    let lines = code.split(separator: "\n", omittingEmptySubsequences: false)

    guard lines.count == 1, let only = lines.first else {
      return lines.enumerated().map { line($1, number: $0 + 1) }.joined(separator: " ")
    }

    let line = SpokenCodeLine(only)

    guard !line.indent.isEmpty else {
      return line.code
    }

    let indent = words(line.indent)
    let written = line.code

    return String(
      localized: "Indented \(indent): \(written)", table: "DesignSystem",
      comment:
        "Read by screen readers for a one-line program that is indented: how far (such as “4 spaces”), then its code as written."
    )
  }

  private static func words(_ indent: [SpokenCodeLine.Run]) -> String {
    indent.map { run in
      let count = run.count

      return run.isTab
        ? String(
          localized: "\(count) tabs", table: "DesignSystem",
          locale: .appLanguage,
          comment:
            "How far a line of a program is indented, read by screen readers, such as “Line 2, indented 1 tab: …”."
        )
        : String(
          localized: "\(count) spaces", table: "DesignSystem",
          locale: .appLanguage,
          comment:
            "How far a line of a program is indented, read by screen readers, such as “Line 2, indented 4 spaces: …”."
        )
    }
    .joined(separator: ", ")
  }
}
