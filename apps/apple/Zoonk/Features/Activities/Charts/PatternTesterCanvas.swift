import SwiftUI

/// Examples are tested as the learner types, the same way grading tests them.
struct PatternTesterCanvas: View {
  let context: ActivityCanvasContext
  let fields: PatternTesterFields

  @ActivityState private var pattern: String
  @State private var selection: TextSelection?
  @FocusState private var isFocused: Bool
  @ActivityState("hintsShown") private var hintsShown = 0
  /// The `.task` below tests the kept pattern again whenever the canvas appears.
  @State private var regexTest: (pattern: String, results: PatternRegex.Results?)?
  @State private var regexPreview = PatternRegexPreview()

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

  var body: some View {
    ChartsCanvas {
      if context.phase != .explore {
        LessonRichText(fields.task, literalNumbers: isRegex)
          .typeStyle(.reading.weight(.medium))
      }

      VStack(alignment: .leading, spacing: 8) {
        field

        CodeSnippetBar(
          snippets: snippetList,
          label: Text(
            "Symbols", tableName: "ActivitiesCharts", comment: "The row of symbol buttons"),
          isEnabled: !isChecked
        ) { snippet in
          snippet.insert(into: &pattern, selection: &selection)
          change(pattern)
        }
      }

      examples

      if context.phase != .explore {
        hints
      }

      if isChecked && !passesAll {
        VStack(alignment: .leading, spacing: 4) {
          (isRegex
            ? Text(
              "A pattern that works", tableName: "ActivitiesCharts",
              comment: "Above a working regex after the check")
            : Text(
              "A formula that works", tableName: "ActivitiesCharts",
              comment: "Above a working formula after the check"))
            .typeStyle(.meta.weight(.medium))
            .foregroundStyle(.mutedForeground)

          Text(verbatim: isRegex ? "/\(fields.solution)/" : "=\(fields.solution)")
            .typeStyle(.reading.monospaced())
            .textSelection(.enabled)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .activityBox()
        }
      }
    }
    .announcesStatus(isRegex ? nil : summary.map(Self.passingLine))
    .task(id: pattern) {
      guard case .regex(let regex) = fields else {
        return
      }

      let pattern = pattern
      let results =
        pattern.isEmpty ? nil : await regexPreview.test(pattern, regex: regex)

      if !Task.isCancelled {
        // The test the canvas opens with reads nothing out: its line shows from the start on main.
        let before = regexTest.map { _ in regexLine }
        regexTest = (pattern, results)

        if let before, let line = regexLine, line != before {
          announcePolitely(line)
        }
      }
    }
    .onDisappear {
      regexPreview.close()
    }
  }

  private var field: some View {
    HStack(spacing: 2) {
      if isRegex {
        Text(verbatim: "/").foregroundStyle(.mutedForeground)
      }

      // Main names its field only to VoiceOver; a SwiftUI field would show its label as a prompt.
      TextField(
        text: Binding(get: { pattern }, set: change), selection: $selection,
        prompt: Text(verbatim: isRegex ? "" : "=A1*B1").fieldPrompt()
      ) {
        EmptyView()
      }
      .accessibilityLabel(
        isRegex
          ? Text("Your pattern", tableName: "ActivitiesCharts", comment: "Label of a regex field")
          : Text("Your formula", tableName: "ActivitiesCharts", comment: "Label of a formula field")
      )
      .textInputAutocapitalization(.never)
      .autocorrectionDisabled()
      .keyboardType(.asciiCapable)
      .disabled(isChecked)
      .focused($isFocused)

      if isRegex {
        Text(verbatim: "/").foregroundStyle(.mutedForeground)
      }
    }
    .typeStyle(.reading.monospaced())
    .fieldBorder(isFocused: isFocused)
  }

  private var snippetList: [SnippetKey] {
    if case .formula(let formula) = fields {
      let names = formula.examples.first?.inputs.map(\.name) ?? []

      return names.map { SnippetKey(label: $0, before: $0, name: $0) } + [
        // "Plus sign", not "Plus": that's the subscription's name.
        SnippetKey(
          label: "+", before: "+",
          name: String(
            localized: "Plus sign", table: "ActivitiesCharts", comment: "The + symbol button")),
        SnippetKey(
          label: "−", before: "-",
          name: String(
            localized: "Minus", table: "ActivitiesCharts", comment: "The − symbol button")),
        SnippetKey(
          label: "×", before: "*",
          name: String(
            localized: "Times", table: "ActivitiesCharts", comment: "The × symbol button")),
        SnippetKey(
          label: "÷", before: "/",
          name: String(
            localized: "Divided by", table: "ActivitiesCharts", comment: "The ÷ symbol button")),
        SnippetKey(
          label: "^", before: "^",
          name: String(
            localized: "To the power of", table: "ActivitiesCharts", comment: "The ^ symbol button")
        ),
        SnippetKey(
          label: "( )", before: "(", after: ")",
          name: String(
            localized: "Parentheses", table: "ActivitiesCharts", comment: "The ( ) symbol button")),
      ]
    }

    return [
      SnippetKey(
        label: "^", before: "^",
        name: String(
          localized: "Start of the text", table: "ActivitiesCharts", comment: "The regex ^ button")),
      SnippetKey(
        label: "$", before: "$",
        name: String(
          localized: "End of the text", table: "ActivitiesCharts", comment: "The regex $ button")),
      SnippetKey(
        label: "\\d", before: "\\d",
        name: String(
          localized: "Any digit", table: "ActivitiesCharts", comment: "The regex \\d button")),
      SnippetKey(
        label: "\\w", before: "\\w",
        name: String(
          localized: "Any letter, digit or underscore", table: "ActivitiesCharts",
          comment: "The regex \\w button")),
      SnippetKey(
        label: "\\s", before: "\\s",
        name: String(
          localized: "Any space", table: "ActivitiesCharts", comment: "The regex \\s button")),
      SnippetKey(
        label: ".", before: ".",
        name: String(
          localized: "Any character", table: "ActivitiesCharts", comment: "The regex . button")),
      SnippetKey(
        label: "[ ]", before: "[", after: "]",
        name: String(
          localized: "One of these characters", table: "ActivitiesCharts",
          comment: "The regex [ ] button")),
      SnippetKey(
        label: "{ }", before: "{", after: "}",
        name: String(
          localized: "Repeat a number of times", table: "ActivitiesCharts",
          comment: "The regex { } button")),
      SnippetKey(
        label: "( )", before: "(", after: ")",
        name: String(localized: "Group", table: "ActivitiesCharts", comment: "The regex ( ) button")
      ),
      SnippetKey(
        label: "?", before: "?",
        name: String(
          localized: "Optional", table: "ActivitiesCharts", comment: "The regex ? button")),
      SnippetKey(
        label: "+", before: "+",
        name: String(
          localized: "One or more", table: "ActivitiesCharts", comment: "The regex + button")),
      SnippetKey(
        label: "*", before: "*",
        name: String(
          localized: "Zero or more", table: "ActivitiesCharts", comment: "The regex * button")),
      SnippetKey(
        label: "|", before: "|",
        name: String(localized: "Or", table: "ActivitiesCharts", comment: "The regex | button")),
    ]
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

      VStack(alignment: .leading, spacing: 20) {
        sampleList(
          Text(
            "Should match", tableName: "ActivitiesCharts", comment: "Examples a regex should match"),
          samples: regex.shouldMatch, results: results?.shouldMatch, shouldMatch: true)
        sampleList(
          Text(
            "Should not match", tableName: "ActivitiesCharts",
            comment: "Examples a regex should not match"),
          samples: regex.shouldNotMatch, results: results?.shouldNotMatch, shouldMatch: false)
      }
    case .formula(let formula):
      formulaExamples(formula)
    }
  }

  private func sampleList(
    _ title: Text, samples: [String], results: [PatternSampleResult]?, shouldMatch: Bool
  ) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        title.typeStyle(.body.weight(.medium))
          .frame(maxWidth: .infinity, alignment: .leading)

        if let results {
          let passing = results.filter(\.passes).count

          Text(
            "\(passing) of \(samples.count) pass", tableName: "ActivitiesCharts"
          )
          .typeStyle(.meta.weight(passing == samples.count ? .regular : .medium))
          .monospacedDigit()
          .foregroundStyle(passing == samples.count ? Color.mutedForeground : .destructiveText)
        }
      }

      VStack(alignment: .leading, spacing: 8) {
        ForEach(Array(samples.enumerated()), id: \.offset) { index, sample in
          sampleRow(sample, result: results?[index], shouldMatch: shouldMatch)
        }
      }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(title)
  }

  /// Main's `SampleRow`: once tested, a passing row takes the right answer's ring and tint and a
  /// failing one the wrong answer's, which also says why.
  @ViewBuilder
  private func sampleRow(_ sample: String, result: PatternSampleResult?, shouldMatch: Bool)
    -> some View
  {
    let row = HStack(spacing: 8) {
      highlighted(sample, match: result?.match, shouldMatch: shouldMatch)
        .typeStyle(.body.monospaced())
        .frame(maxWidth: .infinity, alignment: .leading)

      if let result {
        if !result.passes {
          status(result.passes, shouldMatch: shouldMatch)
            .typeStyle(.meta.weight(.medium))
            .foregroundStyle(.destructiveText)
        }

        Image(systemName: result.passes ? "checkmark" : "xmark")
          .typeStyle(.body.weight(.semibold))
          .foregroundStyle(result.passes ? Color.successText : .destructiveText)
          .accessibilityHidden(true)
      }
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 8)
    .frame(minHeight: 44)

    if let result {
      row
        .answerSurface(result.passes ? .right : .wrong, cornerRadius: Radius.xl)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: sample))
        .accessibilityValue(status(result.passes, shouldMatch: shouldMatch))
    } else {
      row.activityBox()
    }
  }

  private func highlighted(_ sample: String, match: Range<Int>?, shouldMatch: Bool) -> Text {
    let units = Array(sample.utf16)

    guard let match, !match.isEmpty, match.upperBound <= units.count else {
      return Text(verbatim: sample)
    }

    let part = { (range: Range<Int>) in
      String(utf16CodeUnits: Array(units[range]), count: range.count)
    }
    var found = AttributedString(part(match))
    found.foregroundColor = shouldMatch ? .successText : .destructiveText
    found.backgroundColor = (shouldMatch ? Color.success : .destructive).opacity(0.1)

    return Text(
      AttributedString(part(0..<match.lowerBound)) + found
        + AttributedString(part(match.upperBound..<units.count)))
  }

  private func status(_ passes: Bool, shouldMatch: Bool) -> Text {
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
  }

  /// Main's `FormulaExamples`: a table in a box, a failing example's row tinted.
  private func formulaExamples(_ formula: PatternTesterFields.Formula) -> some View {
    let trimmed = pattern.trimmingCharacters(in: .whitespacesAndNewlines)
    let results = trimmed.isEmpty ? nil : PatternFormula.test(pattern, formula: formula)
    let names = formula.examples.first?.inputs.map(\.name) ?? []

    return Grid(alignment: .leading, horizontalSpacing: 0, verticalSpacing: 0) {
      GridRow {
        ForEach(names, id: \.self) { name in
          formulaCell(Text(verbatim: name).monospaced(), alignment: .leading, vertical: 8)
        }
        formulaCell(
          Text(
            "Should give", tableName: "ActivitiesCharts",
            comment: "Column of a formula example's expected output"), alignment: .trailing,
          vertical: 8)
        formulaCell(
          Text(
            "Your result", tableName: "ActivitiesCharts",
            comment: "Column of the learner's formula result"), alignment: .trailing, vertical: 8)
      }
      .typeStyle(.meta.weight(.medium))
      .foregroundStyle(.mutedForeground)
      .background(Color.muted.opacity(0.6), in: .rect)

      ForEach(Array(formula.examples.enumerated()), id: \.offset) { index, example in
        let result = results?[index]

        Divider()

        GridRow {
          ForEach(example.inputs, id: \.name) { input in
            formulaCell(
              Text(verbatim: ActivityNumberFormat.format(input.value)), alignment: .leading)
          }
          formulaCell(
            Text(verbatim: ActivityNumberFormat.format(example.output)).fontWeight(.medium),
            alignment: .trailing)
          HStack(spacing: 6) {
            if let value = result?.value {
              Text(verbatim: ActivityNumberFormat.format(value))
            }
            if let result, result.passes || result.value != nil {
              Image(systemName: result.passes ? "checkmark" : "xmark")
                .foregroundStyle(result.passes ? Color.successText : .destructiveText)
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
          .padding(.horizontal, 12)
          .padding(.vertical, 10)
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .trailing)
        }
        .typeStyle(.body)
        .monospacedDigit()
        .background(result?.passes == false ? Color.destructive.opacity(0.1) : .clear, in: .rect)
      }
    }
    .activityBox()
    .clipShape(.rect(cornerRadius: Radius.xl, style: .continuous))
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      Text(
        "Examples for your formula", tableName: "ActivitiesCharts",
        comment: "The table of formula examples"))
  }

  private func formulaCell(_ text: Text, alignment: Alignment, vertical: CGFloat = 10)
    -> some View
  {
    text
      .padding(.horizontal, 12)
      .padding(.vertical, vertical)
      // As tall as its row, so the row's tint has no gaps.
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: alignment)
  }

  /// Main's `PatternHints`: one more at each tap; a checked answer that still fails an example
  /// shows them all.
  @ViewBuilder
  private var hints: some View {
    let reveals = isChecked && !passesAll
    let visible = reveals ? fields.hints : Array(fields.hints.prefix(hintsShown))

    if !visible.isEmpty {
      VStack(alignment: .leading, spacing: 8) {
        ForEach(visible, id: \.self) { hint in
          Label {
            RichInlineText(hintLine(hint))
              .typeStyle(.body)
          } icon: {
            Image(systemName: "lightbulb")
              .foregroundStyle(.vizHighlight)
          }
        }
      }
    }

    if !reveals && hintsShown < fields.hints.count {
      Button {
        let hint = fields.hints[hintsShown]
        hintsShown += 1
        announcePolitely(hintLine(hint).said)
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
      .controlSize(.large)
      .disabled(isChecked)
    }
  }

  /// Main's hint: the mistake in bold, then what to try, on one line.
  private func hintLine(_ hint: PatternTesterFields.Hint) -> RichInline {
    var mistake = LessonRichText.typeset(hint.mistake, literalNumbers: isRegex)

    for run in mistake.text.runs {
      var intent = run.inlinePresentationIntent ?? []
      intent.insert(.stronglyEmphasized)
      mistake.text[run.range].inlinePresentationIntent = intent
    }

    return mistake + RichInline(text: AttributedString(": "))
      + LessonRichText.typeset(hint.hint, literalNumbers: isRegex)
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
      locale: .appLanguage, comment: "How many examples a pattern gets right")
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

  private var passesAll: Bool {
    summary.map { $0.passing == $0.total } ?? false
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
}
