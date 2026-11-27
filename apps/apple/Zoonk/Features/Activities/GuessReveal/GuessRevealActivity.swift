import SwiftUI

extension ActivityRenderer {
  static let guessReveal = ActivityRenderer(
    template: "guessReveal", badge: .always(.estimateFirst), answersOnCanvas: true
  ) { context, fields in
    GuessRevealCanvas(fields: fields, context: context)
  }
}

struct GuessRevealFields: Decodable, Hashable, Sendable {
  struct Working: Decodable, Hashable, Sendable {
    let expression: String
    let label: String
  }

  struct Truth: Decodable, Hashable, Sendable {
    let kind: String
    let expression: String?
    let workings: [Working]?
    let value: Double?
  }

  let comparison: String?
  let max: Double
  let min: Double
  let scale: GuessScale.Kind
  let takeaway: String
  let truth: Truth
  let unit: String

  var guessScale: GuessScale {
    GuessScale(min: min, max: max, kind: scale)
  }

  /// The real value, as core's `trueValue` computes it.
  var trueValue: Double? {
    truth.kind == "cited"
      ? truth.value : truth.expression.flatMap { ActivityExpression.evaluate($0) }
  }
}

/// The guess comes before anything is explained, so the gap to the real value is felt.
private struct GuessRevealCanvas: View {
  let fields: GuessRevealFields
  let context: ActivityCanvasContext

  var body: some View {
    let guess = context.answer?.number
    let actual = checkAnswer ?? fields.trueValue
    let isRevealed = if case .checked = context.phase { true } else { false }

    VStack(alignment: .leading, spacing: 16) {
      ActivityGuessScaleView(
        scale: fields.guessScale, unit: fields.unit, guess: guess, actual: actual,
        isRevealed: isRevealed
      ) { value in
        context.setAnswer(.numeric(value))
      }

      if isRevealed, let actual {
        VStack(alignment: .leading, spacing: 10) {
          if let guess {
            comparisonText(
              GuessScale.compare(
                guess: guess, actual: actual, isCorrect: isCorrect, unit: fields.unit),
              actual: actual
            )
            .typeStyle(.body.weight(.semibold))
          }

          if let workings = fields.truth.workings, fields.truth.kind == "computed" {
            Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 8, verticalSpacing: 4) {
              ForEach(Array(workings.enumerated()), id: \.offset) { _, working in
                GridRow {
                  Text(
                    verbatim: ActivityExpression.evaluate(working.expression).map {
                      ActivityNumberFormat.format($0)
                    } ?? ""
                  )
                  .typeWeight(.semibold)
                  .monospacedDigit()
                  .gridColumnAlignment(.trailing)
                  Text(working.label)
                    .foregroundStyle(.mutedForeground)
                }
                .accessibilityElement(children: .combine)
              }
            }
            .typeStyle(.note)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .activityBox(cornerRadius: Radius.option)
          }

          if let comparison = fields.comparison {
            LessonRichText(comparison)
              .typeStyle(.body)
          }

          LessonRichText(fields.takeaway)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
      }
    }
  }

  private var checkAnswer: Double? {
    if case .numeric(_, let answer, _, _, _, _, _) = context.check { answer } else { nil }
  }

  private var isCorrect: Bool {
    if case .checked(let isCorrect) = context.phase { isCorrect } else { false }
  }

  private func comparisonText(_ comparison: GuessScale.Comparison, actual: Double) -> Text {
    switch comparison {
    case .close:
      return Text(
        "Your guess is close to the real value.", tableName: "Activities",
        comment: "After the check: the guess was close enough")
    case .tooBig(let times):
      return Text(
        "Your guess is about \(ActivityNumberFormat.format(times)) times too big.",
        tableName: "Activities",
        comment: "After the check: how many times bigger the guess was than the real value")
    case .tooSmall(let times):
      return Text(
        "Your guess is about \(ActivityNumberFormat.format(times)) times too small.",
        tableName: "Activities",
        comment: "After the check: how many times smaller the guess was than the real value")
    case .off(let difference):
      let digits = ActivityNumberFormat.displayDigits(actual, unit: fields.unit)
      let shown = ActivityNumberFormat.guess(abs(difference), unit: fields.unit, digits: digits)
      return Text(
        "Your guess is off by \(shown).",
        tableName: "Activities",
        comment: "After the check: how far the guess was from the real value")
    }
  }
}
