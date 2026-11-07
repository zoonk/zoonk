import SwiftUI

/// Examples are tested as the learner types, the same way grading tests them.
struct PatternTesterCanvas: View {
  let context: ActivityCanvasContext
  let fields: PatternTesterFields

  @ActivityState private var pattern: String
  @State private var selection: TextSelection?
  @ActivityState("hintsShown") private var hintsShown = 0
  /// The `.task` below tests the kept pattern again whenever the canvas appears.
  @State private var regexTest: (pattern: String, results: PatternRegex.Results?)?

  init(context: ActivityCanvasContext, fields: PatternTesterFields) {
    self.context = context
    self.fields = fields

    let answered = context.answer.flatMap { try? $0.decode(as: PatternTesterAnswer.self) }?.pattern
    _pattern = ActivityState(
      wrappedValue: context.phase == .explore ? fields.solution : answered ?? "", "pattern")
  }

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  private var isRegex: Bool {
    if case .regex = fields { return true }
    return false
  }

  private struct Snippet: Identifiable {
    let label: String
    let before: String
    var after = ""
    let name: String

    var id: String { label }
  }

  var body: some View {
    ChartsCanvas {
      LessonRichText(fields.task, literalNumbers: isRegex)
        .typeStyle(.body)

      field

      if !isChecked {
        snippets
      }

      examples

      if let summary {
        Text(Self.passingLine(summary))
          .typeStyle(.body.weight(.medium).monospaced())
      }

      if context.phase != .explore {
        hints
      }

      if isChecked {
        VStack(alignment: .leading, spacing: 4) {
          isRegex
            ? Text(
              "A pattern that works", tableName: "ActivitiesCharts",
              comment: "Above a working regex after the check")
            : Text(
              "A formula that works", tableName: "ActivitiesCharts",
              comment: "Above a working formula after the check")
          Text(verbatim: isRegex ? "/\(fields.solution)/" : "=\(fields.solution)")
            .typeStyle(.body.monospaced())
            .textSelection(.enabled)
        }
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      }
    }
    .announcesStatus(isRegex ? nil : summary.map(Self.passingLine))
    .task(id: pattern) {
      guard case .regex(let regex) = fields else {
        return
      }

      let pattern = pattern
      let results =
        pattern.isEmpty ? nil : await PatternRegexPreview.shared.test(pattern, regex: regex)

      if !Task.isCancelled {
        // The test the canvas opens with reads nothing out: its line shows from the start on main.
        let before = regexTest.map { _ in regexLine }
        regexTest = (pattern, results)

        if let before, let line = regexLine, line != before {
          announcePolitely(line)
        }
      }
    }
  }

  private var field: some View {
    VStack(alignment: .leading, spacing: 6) {
      isRegex
        ? Text("Your pattern", tableName: "ActivitiesCharts", comment: "Label of a regex field")
        : Text("Your formula", tableName: "ActivitiesCharts", comment: "Label of a formula field")

      HStack(spacing: 2) {
        if isRegex {
          Text(verbatim: "/").foregroundStyle(.mutedForeground)
        }

        TextField(text: Binding(get: { pattern }, set: change), selection: $selection) {
          isRegex
            ? Text("Your pattern", tableName: "ActivitiesCharts", comment: "Label of a regex field")
            : Text(verbatim: "=A1*B1")
        }
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .keyboardType(.asciiCapable)
        .disabled(isChecked)

        if isRegex {
          Text(verbatim: "/").foregroundStyle(.mutedForeground)
        }
      }
      .typeStyle(.section.weight(.regular).monospaced())
      .padding(.horizontal)
      .frame(minHeight: 52)
      .background(.background, in: .rect(cornerRadius: Radius.option, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: Radius.option, style: .continuous).strokeBorder(Color.border)
      }
    }
    .typeStyle(.body.weight(.medium))
  }

  private var snippetList: [Snippet] {
    if case .formula(let formula) = fields {
      let names = formula.examples.first?.inputs.map(\.name) ?? []

      return names.map { Snippet(label: $0, before: $0, name: $0) } + [
        // "Plus sign", not "Plus": that's the subscription's name.
        Snippet(
          label: "+", before: "+",
          name: String(
            localized: "Plus sign", table: "ActivitiesCharts", comment: "The + symbol button")),
        Snippet(
          label: "−", before: "-",
          name: String(
            localized: "Minus", table: "ActivitiesCharts", comment: "The − symbol button")),
        Snippet(
          label: "×", before: "*",
          name: String(
            localized: "Times", table: "ActivitiesCharts", comment: "The × symbol button")),
        Snippet(
          label: "÷", before: "/",
          name: String(
            localized: "Divided by", table: "ActivitiesCharts", comment: "The ÷ symbol button")),
        Snippet(
          label: "^", before: "^",
          name: String(
            localized: "To the power of", table: "ActivitiesCharts", comment: "The ^ symbol button")
        ),
        Snippet(
          label: "( )", before: "(", after: ")",
          name: String(
            localized: "Parentheses", table: "ActivitiesCharts", comment: "The ( ) symbol button")),
      ]
    }

    return [
      Snippet(
        label: "^", before: "^",
        name: String(
          localized: "Start of the text", table: "ActivitiesCharts", comment: "The regex ^ button")),
      Snippet(
        label: "$", before: "$",
        name: String(
          localized: "End of the text", table: "ActivitiesCharts", comment: "The regex $ button")),
      Snippet(
        label: "\\d", before: "\\d",
        name: String(
          localized: "Any digit", table: "ActivitiesCharts", comment: "The regex \\d button")),
      Snippet(
        label: "\\w", before: "\\w",
        name: String(
          localized: "Any letter, digit or underscore", table: "ActivitiesCharts",
          comment: "The regex \\w button")),
      Snippet(
        label: "\\s", before: "\\s",
        name: String(
          localized: "Any space", table: "ActivitiesCharts", comment: "The regex \\s button")),
      Snippet(
        label: ".", before: ".",
        name: String(
          localized: "Any character", table: "ActivitiesCharts", comment: "The regex . button")),
      Snippet(
        label: "[ ]", before: "[", after: "]",
        name: String(
          localized: "One of these characters", table: "ActivitiesCharts",
          comment: "The regex [ ] button")),
      Snippet(
        label: "{ }", before: "{", after: "}",
        name: String(
          localized: "Repeat a number of times", table: "ActivitiesCharts",
          comment: "The regex { } button")),
      Snippet(
        label: "( )", before: "(", after: ")",
        name: String(localized: "Group", table: "ActivitiesCharts", comment: "The regex ( ) button")
      ),
      Snippet(
        label: "?", before: "?",
        name: String(
          localized: "Optional", table: "ActivitiesCharts", comment: "The regex ? button")),
      Snippet(
        label: "+", before: "+",
        name: String(
          localized: "One or more", table: "ActivitiesCharts", comment: "The regex + button")),
      Snippet(
        label: "*", before: "*",
        name: String(
          localized: "Zero or more", table: "ActivitiesCharts", comment: "The regex * button")),
      Snippet(
        label: "|", before: "|",
        name: String(localized: "Or", table: "ActivitiesCharts", comment: "The regex | button")),
    ]
  }

  private var snippets: some View {
    ScrollView(.horizontal) {
      HStack(spacing: 6) {
        ForEach(snippetList) { snippet in
          Button {
            insert(snippet)
          } label: {
            Text(verbatim: snippet.label)
              .typeStyle(.body.monospaced())
              .frame(minWidth: 28, minHeight: 28)
          }
          .buttonStyle(.outline)
          .accessibilityLabel(Text(verbatim: snippet.name))
        }
      }
    }
    .scrollIndicators(.hidden)
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      Text("Symbols", tableName: "ActivitiesCharts", comment: "The row of symbol buttons"))
  }

  @ViewBuilder
  private var examples: some View {
    switch fields {
    case .regex(let regex):
      let tested = regexTest?.pattern == pattern ? regexTest : nil
      let results = tested?.results

      if tested != nil, !pattern.isEmpty, results == nil {
        Text(Self.invalidLine)
          .typeStyle(.note)
          .foregroundStyle(.destructiveText)
      }

      sampleList(
        Text(
          "Should match", tableName: "ActivitiesCharts", comment: "Examples a regex should match"),
        samples: regex.shouldMatch, results: results?.shouldMatch, shouldMatch: true)
      sampleList(
        Text(
          "Should not match", tableName: "ActivitiesCharts",
          comment: "Examples a regex should not match"),
        samples: regex.shouldNotMatch, results: results?.shouldNotMatch, shouldMatch: false)
    case .formula(let formula):
      formulaExamples(formula)
    }
  }

  private func sampleList(
    _ title: Text, samples: [String], results: [PatternSampleResult]?, shouldMatch: Bool
  ) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      title.typeStyle(.note.weight(.medium)).foregroundStyle(.mutedForeground)

      ForEach(Array(samples.enumerated()), id: \.offset) { index, sample in
        let result = results?[index]

        HStack {
          highlighted(sample, match: result?.match)
            .typeStyle(.body.monospaced())
          Spacer()
          if let result {
            status(result.passes, shouldMatch: shouldMatch)
          }
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 36)
        .background(.background, in: .rect(cornerRadius: Radius.md, style: .continuous))
        .accessibilityElement(children: .combine)
      }
    }
  }

  private func highlighted(_ sample: String, match: Range<Int>?) -> Text {
    let units = Array(sample.utf16)

    guard let match, match.lowerBound <= units.count, match.upperBound <= units.count else {
      return Text(verbatim: sample)
    }

    let part = { (range: Range<Int>) in
      String(utf16CodeUnits: Array(units[range]), count: range.count)
    }
    let before = part(0..<match.lowerBound)
    let found = part(match)
    let after = part(match.upperBound..<units.count)

    return Text(
      "\(Text(verbatim: before))\(Text(verbatim: found).underline().foregroundStyle(.vizAccent))\(Text(verbatim: after))"
    )
  }

  private func status(_ passes: Bool, shouldMatch: Bool) -> some View {
    let text: Text =
      passes
      ? (shouldMatch
        ? Text(
          "matches", tableName: "ActivitiesCharts",
          comment: "A sample the regex matches, as it should")
        : Text(
          "doesn't match", tableName: "ActivitiesCharts",
          comment: "A sample the regex doesn't match, as it should"))
      : (shouldMatch
        ? Text(
          "no match", tableName: "ActivitiesCharts",
          comment: "A sample the regex should match but doesn't")
        : Text(
          "matched", tableName: "ActivitiesCharts",
          comment: "A sample the regex shouldn't match but does"))

    return Label {
      text
    } icon: {
      Image(systemName: passes ? "checkmark" : "xmark")
    }
    .typeStyle(.note.weight(.medium))
    .foregroundStyle(passes ? Color.successText : .destructiveText)
  }

  private func formulaExamples(_ formula: PatternTesterFields.Formula) -> some View {
    let trimmed = pattern.trimmingCharacters(in: .whitespacesAndNewlines)
    let results = trimmed.isEmpty ? nil : PatternFormula.test(pattern, formula: formula)

    return Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 8) {
      GridRow {
        ForEach(formula.examples.first?.inputs ?? [], id: \.name) { input in
          Text(verbatim: input.name)
        }
        Text(
          "Should give", tableName: "ActivitiesCharts",
          comment: "Column of a formula example's expected output")
        Text(
          "Your result", tableName: "ActivitiesCharts",
          comment: "Column of the learner's formula result")
      }
      .typeStyle(.note.weight(.medium))
      .foregroundStyle(.mutedForeground)

      ForEach(Array(formula.examples.enumerated()), id: \.offset) { index, example in
        let result = results?[index]

        GridRow {
          ForEach(example.inputs, id: \.name) { input in
            Text(verbatim: ActivityNumberFormat.format(input.value))
          }
          Text(verbatim: ActivityNumberFormat.format(example.output)).typeWeight(.medium)
          HStack(spacing: 4) {
            Text(verbatim: result?.value.map { ActivityNumberFormat.format($0) } ?? "–")
            if let result {
              Image(systemName: result.passes ? "checkmark" : "xmark")
                .foregroundStyle(result.passes ? Color.success : .destructive)
                .accessibilityLabel(
                  result.passes
                    ? Text(
                      "matches", tableName: "ActivitiesCharts",
                      comment: "A sample the regex matches, as it should")
                    : Text(
                      "doesn't match", tableName: "ActivitiesCharts",
                      comment: "A sample the regex doesn't match, as it should"))
            }
          }
        }
        .typeStyle(.body.monospaced())
      }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      Text(
        "Examples for your formula", tableName: "ActivitiesCharts",
        comment: "The table of formula examples"))
  }

  @ViewBuilder
  private var hints: some View {
    let visible = isChecked ? fields.hints : Array(fields.hints.prefix(hintsShown))

    if !visible.isEmpty {
      VStack(alignment: .leading, spacing: 8) {
        ForEach(visible, id: \.self) { hint in
          VStack(alignment: .leading, spacing: 2) {
            LessonRichText(hint.mistake, literalNumbers: isRegex)
              .typeStyle(.note.weight(.semibold))
            LessonRichText(hint.hint, literalNumbers: isRegex).typeStyle(.note)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(12)
          .background(
            Color.warning.opacity(0.12), in: .rect(cornerRadius: Radius.lg, style: .continuous))
        }
      }
    }

    if !isChecked && hintsShown < fields.hints.count {
      Button {
        let hint = fields.hints[hintsShown]
        hintsShown += 1
        announcePolitely(
          [hint.mistake, hint.hint].map { LessonRichText.typeset($0, literalNumbers: isRegex).said }
            .joined(separator: ": "))
      } label: {
        Label {
          hintsShown == 0
            ? Text("Show a hint", tableName: "ActivitiesCharts", comment: "Reveals the first hint")
            : Text(
              "Show another hint", tableName: "ActivitiesCharts", comment: "Reveals one more hint")
        } icon: {
          Image(systemName: "lightbulb")
        }
      }
      .buttonStyle(.outline)
    }
  }

  /// The last pattern tested, even while the next one runs, so typing reads a line out only when a
  /// test changes it.
  private var regexLine: String? {
    guard let regexTest, !regexTest.pattern.isEmpty else {
      return nil
    }

    return regexTest.results.map { Self.passingLine(Self.tally($0)) } ?? Self.invalidLine
  }

  private static func passingLine(_ summary: (passing: Int, total: Int)) -> String {
    String(
      localized: "\(summary.passing) of \(summary.total) examples pass.", table: "ActivitiesCharts",
      comment: "How many examples a pattern gets right")
  }

  private static var invalidLine: String {
    String(
      localized:
        "This pattern can't run. Check that brackets close, and don't repeat a group that already repeats inside.",
      table: "ActivitiesCharts", comment: "A regex that doesn't compile or is unsafe")
  }

  private static func tally(_ results: PatternRegex.Results) -> (passing: Int, total: Int) {
    let all = results.shouldMatch + results.shouldNotMatch
    return (all.filter(\.passes).count, all.count)
  }

  private var summary: (passing: Int, total: Int)? {
    switch fields {
    case .regex:
      guard regexTest?.pattern == pattern, let results = regexTest?.results else {
        return nil
      }

      return Self.tally(results)
    case .formula(let formula):
      guard !pattern.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        return nil
      }

      let results = PatternFormula.test(pattern, formula: formula)
      return (results.filter(\.passes).count, results.count)
    }
  }

  private func change(_ next: String) {
    pattern = next

    guard context.phase != .explore else {
      return
    }

    let trimmed = next.trimmingCharacters(in: .whitespacesAndNewlines)
    context.setAnswer(
      trimmed.isEmpty ? nil : try? ActivityAnswer(encoding: PatternTesterAnswer(pattern: next)))
  }

  private func insert(_ snippet: Snippet) {
    var range = pattern.endIndex..<pattern.endIndex

    if case .selection(let selected) = selection?.indices {
      range = selected
    }

    let selected = String(pattern[range])
    let inserted = snippet.before + selected + snippet.after
    let next = pattern.replacingCharacters(in: range, with: inserted)
    let offset =
      pattern.distance(from: pattern.startIndex, to: range.lowerBound) + snippet.before.count
      + selected.count
    change(next)

    let cursor = pattern.index(pattern.startIndex, offsetBy: offset)
    selection = TextSelection(insertionPoint: cursor)
  }
}
