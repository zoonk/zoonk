import SwiftUI

struct ActivityStepView: View {
  @Environment(\.activityRenderers) private var activityRenderers

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
        image: step.image, description: content.image, isPending: step.imagePending)
    case .turn:
      turn
    }
  }

  @ViewBuilder
  private var turn: some View {
    let renderer = activityRenderers.renderer(for: content.template)
    let checkFirst = renderer?.showsCheckFirst(content) ?? false

    if checkFirst {
      checkArea
    }

    let canvasContext = ActivityCanvasContext(
      template: content.template, payload: content.payload, check: content.check,
      phase: context.result.map { .checked(isCorrect: $0.isCorrect) } ?? .answering,
      answer: answer,
      setAnswer: { value in
        if !context.isLocked {
          context.select(value.map(LessonAnswer.activity))
        }
      })

    if let renderer {
      renderer.canvas(canvasContext)
    } else {
      ActivityFallbackCanvas(context: canvasContext)
    }

    if let source = content.data?.source {
      Text(
        "Source: \(source.title)\(source.publisher.map { ", \($0)" } ?? "")", tableName: "Player",
        comment: "Where an activity's numbers come from"
      )
      .font(.caption)
      .foregroundStyle(.secondary)
    } else if content.data?.isExample == true {
      Text(
        "Example numbers", tableName: "Player",
        comment: "An activity's numbers are made up to show the idea"
      )
      .font(.caption)
      .foregroundStyle(.secondary)
    }

    if !checkFirst {
      checkArea
    }
  }

  @ViewBuilder
  private var checkArea: some View {
    switch content.check {
    case .choice(let question, let options, _, _):
      LessonRichText(question)
        .font(.headline)
      LessonOptionList(
        options: options.map { LessonOption(id: $0.id, text: $0.text, isCorrect: $0.isCorrect) },
        selectedId: answer?.optionId,
        isChecked: context.result != nil,
        isLocked: context.isLocked
      ) { context.select(.activity(.choice(optionId: $0))) }
    case .numeric(let question, let expected, let tolerance, let unit, _, _, _):
      LessonRichText(question)
        .font(.headline)
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

/// The field keeps what the learner typed ("0," on the way to "0,17") and answers with the number it
/// reads.
private struct NumericAnswerField: View {
  @Environment(\.locale) private var locale
  @State private var typed: String?

  let value: Double?
  let expected: Double
  let tolerance: ActivityCheck.Tolerance
  let unit: String?
  let isLocked: Bool
  let onChange: (Double?) -> Void

  var body: some View {
    HStack {
      TextField(text: Binding(get: { typed ?? shown }, set: type)) {
        Text("Your answer", tableName: "Player", comment: "Placeholder of a number answer")
      }
      .keyboardType(.decimalPad)
      .disabled(isLocked)
      .font(.title3.monospacedDigit())

      if let unit {
        Text(unit).foregroundStyle(.secondary)
      }
    }
    .padding()
    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 16))
    .onChange(of: value) {
      // An answer set elsewhere (going back to the screen) shows as itself.
      if let typed, parseLocalizedNumber(typed, locale: locale) != value {
        self.typed = nil
      }
    }
  }

  /// A number the canvas set, at the answer's precision rather than its raw reading.
  private var shown: String {
    value.map {
      formatLocalizedNumber(
        $0,
        fractionDigits: exactFractionDigitsFor(expected: expected, tolerance: tolerance, value: $0),
        locale: locale)
    } ?? ""
  }

  private func type(_ text: String) {
    typed = text
    onChange(parseLocalizedNumber(text, locale: locale))
  }
}
