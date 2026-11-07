import SwiftUI

struct ActivityStepView: View {
  @Environment(\.activityRenderers) private var activityRenderers
  @Environment(\.isPaneSplit) private var isPaneSplit

  let step: LessonStep
  let content: ActivityStepContent
  let context: LessonStepContext
  let part: LessonStepPart

  private var answer: ActivityAnswer? {
    if case .activity(let answer) = context.answer {
      return answer
    }

    return nil
  }

  /// On a spread, a canvas the question asks about sits under its prompt, and the learner's page
  /// holds the question and its answer. An interaction's canvas is the answer, so it stays there.
  private var isCanvasOnScreen: Bool {
    if case .interaction = content.check {
      return false
    }

    return isPaneSplit
  }

  var body: some View {
    switch part {
    case .screen:
      if let badge = activityRenderers.renderer(for: content.template)?.badge.badge(for: content) {
        Label {
          Text(badge.title)
        } icon: {
          Image(systemName: badge.systemImage)
        }
        .chip()
      }

      LessonQuestionText(text: content.prompt)
      LessonPictureView(
        image: step.image, alt: step.picture?.alt, isPending: step.imagePending, asks: true)

      if isCanvasOnScreen {
        canvas
      }
    case .turn:
      turn
    }
  }

  /// The question keeps its place through a fold, so a number half typed ("0,") stays as it is.
  @ViewBuilder
  private var turn: some View {
    let checkLeads =
      !isCanvasOnScreen
      && activityRenderers.renderer(for: content.template)?.showsCheckFirst(content) == true

    if checkLeads {
      checkArea
    }

    if !isCanvasOnScreen {
      canvas
    }

    if !checkLeads {
      checkArea
    }
  }

  @ViewBuilder
  private var canvas: some View {
    let canvasContext = ActivityCanvasContext(
      template: content.template, payload: content.payload, check: content.check,
      phase: context.result.map { .checked(isCorrect: $0.isCorrect) } ?? .answering,
      answer: answer,
      setAnswer: { value in
        if !context.isLocked {
          context.select(value.map(LessonAnswer.activity))
        }
      }, baseMap: content.baseMap)

    // As on main, nothing on the canvas answers (taps, menus, number keys) until a required
    // picture is drawn.
    Group {
      if let renderer = activityRenderers.renderer(for: content.template) {
        renderer.canvas(canvasContext)
      } else {
        ActivityFallbackCanvas(context: canvasContext)
      }

      ActivityDataNote(data: content.data)
    }
    .disabled(context.waitsForPicture)
  }

  @ViewBuilder
  private var checkArea: some View {
    switch content.check {
    case .choice(let question, let options, _, _):
      LessonRichText(question)
        .typeStyle(.body.weight(.semibold))
      LessonOptionList(
        options: options.map { LessonOption(id: $0.id, text: $0.text, isCorrect: $0.isCorrect) },
        selectedId: answer?.optionId,
        isChecked: context.result != nil,
        isLocked: context.isLocked
      ) { context.select(.activity(.choice(optionId: $0))) }
    case .numeric(let question, let expected, let tolerance, let unit, _, _, _):
      LessonRichText(question)
        .typeStyle(.body.weight(.semibold))
      NumericAnswerField(
        value: answer?.number, expected: expected, tolerance: tolerance, unit: unit,
        isLocked: context.isLocked
      ) { number in
        context.select(number.map { .activity(.numeric($0)) })
      }
    case .interaction:
      EmptyView()
    }
  }
}

/// Main's `ActivityDataNote`: where a model's numbers come from, linked when they have a page, or
/// that they're an example.
struct ActivityDataNote: View {
  let data: ActivityData?

  var body: some View {
    Group {
      if data?.isExample == true {
        Text(
          "Example numbers, not real data", tableName: "Player",
          comment: "An activity's numbers are made up to show the idea")
      } else if let source = data?.source {
        Text(
          "Source: \(name(source))", tableName: "Player",
          comment: "Where a model's numbers come from")
      }
    }
    .typeStyle(.meta)
    .foregroundStyle(.mutedForeground)
  }

  private func name(_ source: ActivityData.Source) -> AttributedString {
    let details = [source.publisher, source.year.map(String.init)].compactMap(\.self)
    var name = AttributedString(
      details.isEmpty ? source.title : "\(source.title) (\(details.joined(separator: ", ")))")

    if let url = source.url.flatMap(URL.init(string:)) {
      name.link = url
      name.underlineStyle = .single
    }

    return name
  }
}

/// The field keeps what the learner typed ("0," on the way to "0,17") and answers with the number it
/// reads.
private struct NumericAnswerField: View {
  @ActivityState("typedNumber") private var typed: String? = nil
  @FocusState private var isFocused: Bool

  let value: Double?
  let expected: Double
  let tolerance: ActivityCheck.Tolerance
  let unit: String?
  let isLocked: Bool
  let onChange: (Double?) -> Void

  var body: some View {
    let unitLeads = unit.map { ActivityNumberFormat.unitLeads($0) } ?? false

    HStack {
      if let unit, unitLeads {
        Text(unit).foregroundStyle(.mutedForeground).accessibilityHidden(true)
      }

      TextField(text: Binding(get: { typed ?? shown }, set: type)) {
        Text("Your answer", tableName: "Player", comment: "Placeholder of a number answer")
      }
      .keyboardType(.decimalPad)
      .focused($isFocused)
      .disabled(isLocked)
      .accessibilityHint(Text(verbatim: unit ?? ""))

      if let unit, !unitLeads {
        Text(unit).foregroundStyle(.mutedForeground).accessibilityHidden(true)
      }
    }
    .typeStyle(.reading.monospacedDigit())
    .fieldBorder(isFocused: isFocused, minHeight: 44)
    .onChange(of: value) {
      // An answer set elsewhere (going back to the screen) shows as itself.
      if let typed, parseLocalizedNumber(typed, locale: .courseLanguage) != value {
        self.typed = nil
      }
    }
  }

  /// A number the canvas set, at the answer's precision rather than its raw reading.
  private var shown: String {
    value.map {
      ActivityNumberFormat.format(
        $0, digits: exactFractionDigitsFor(expected: expected, tolerance: tolerance, value: $0),
        grouping: false)
    } ?? ""
  }

  private func type(_ text: String) {
    typed = text
    onChange(parseLocalizedNumber(text, locale: .courseLanguage))
  }
}
