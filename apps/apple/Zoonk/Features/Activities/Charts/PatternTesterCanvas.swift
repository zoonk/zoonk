import SwiftUI

/// Write a regular expression or a spreadsheet formula and watch it tested against every example
/// as you type, the same way grading tests it (main's `PatternTesterActivity`). Symbol buttons
/// save hunting on a phone keyboard, and hints come one at a time on request. After the check, a
/// pattern that works is shown; explored, it starts with one to read and change.
struct PatternTesterCanvas: View {
  let context: ActivityCanvasContext
  let fields: PatternTesterFields

  @State private var pattern: String
  @State private var selection: TextSelection?
  @State private var hintsShown = 0
  private let format = ChartsNumberFormat()

  init(context: ActivityCanvasContext, fields: PatternTesterFields) {
    self.context = context
    self.fields = fields

    let answered = context.answer.flatMap { try? $0.decode(as: PatternTesterAnswer.self) }?.pattern
    _pattern = State(initialValue: context.phase == .explore ? fields.solution : answered ?? "")
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
      LessonRichText(fields.task)
        .font(.subheadline)

      field

      if !isChecked {
        snippets
      }

      examples

      if let summary {
        Text(
          "\(summary.passing) of \(summary.total) examples pass.", tableName: "ActivitiesCharts",
          comment: "How many examples a pattern gets right"
        )
        .font(.subheadline.weight(.medium).monospacedDigit())
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
            .font(.body.monospaced())
            .textSelection(.enabled)
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
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
          Text(verbatim: "/").foregroundStyle(.secondary)
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
          Text(verbatim: "/").foregroundStyle(.secondary)
        }
      }
      .font(.title3.monospaced())
      .padding(.horizontal)
      .frame(minHeight: 52)
      .background(.background, in: .rect(cornerRadius: 12, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Color(.separator))
      }
    }
    .font(.subheadline.weight(.medium))
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
              .font(.body.monospaced())
              .frame(minWidth: 28, minHeight: 28)
          }
          .buttonStyle(.bordered)
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
      let results = pattern.isEmpty ? nil : PatternRegex.test(pattern, regex: regex)

      if !pattern.isEmpty && results == nil {
        Text(
          "This pattern can't run. Check that brackets close, and don't repeat a group that already repeats inside.",
          tableName: "ActivitiesCharts", comment: "A regex that doesn't compile or is unsafe"
        )
        .font(.footnote)
        .foregroundStyle(.destructive)
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
      title.font(.footnote.weight(.medium)).foregroundStyle(.secondary)

      ForEach(Array(samples.enumerated()), id: \.offset) { index, sample in
        let result = results?[index]

        HStack {
          highlighted(sample, match: result?.match)
            .font(.body.monospaced())
          Spacer()
          if let result {
            status(result.passes, shouldMatch: shouldMatch)
          }
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 36)
        .background(.background, in: .rect(cornerRadius: 8, style: .continuous))
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
      "\(Text(verbatim: before))\(Text(verbatim: found).underline().foregroundStyle(.mint))\(Text(verbatim: after))"
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
    .font(.footnote.weight(.medium))
    .foregroundStyle(passes ? Color.success : .destructive)
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
      .font(.footnote.weight(.medium))
      .foregroundStyle(.secondary)

      ForEach(Array(formula.examples.enumerated()), id: \.offset) { index, example in
        let result = results?[index]

        GridRow {
          ForEach(example.inputs, id: \.name) { input in
            Text(verbatim: format(input.value))
          }
          Text(verbatim: format(example.output)).fontWeight(.medium)
          HStack(spacing: 4) {
            Text(verbatim: result?.value.map { format($0) } ?? "–")
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
        .font(.subheadline.monospacedDigit())
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
            LessonRichText(hint.mistake).font(.footnote.weight(.semibold))
            LessonRichText(hint.hint).font(.footnote)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(12)
          .background(Color.warning.opacity(0.12), in: .rect(cornerRadius: 10, style: .continuous))
        }
      }
    }

    if !isChecked && hintsShown < fields.hints.count {
      Button {
        hintsShown += 1
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
      .buttonStyle(.bordered)
    }
  }

  private var summary: (passing: Int, total: Int)? {
    switch fields {
    case .regex(let regex):
      guard !pattern.isEmpty, let results = PatternRegex.test(pattern, regex: regex) else {
        return nil
      }

      let all = results.shouldMatch + results.shouldNotMatch
      return (all.filter(\.passes).count, all.count)
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

  /// Types a symbol at the cursor (around the selection for pairs), leaving the cursor inside.
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
