import SwiftUI

extension ActivityRenderer {
  static let guessReveal = ActivityRenderer(template: "guessReveal") { context in
    if let fields = try? context.fields(as: GuessRevealFields.self) {
      GuessRevealCanvas(fields: fields, context: context)
    }
  }
}

struct GuessRevealFields: Decodable, Hashable, Sendable {
  struct Working: Decodable, Hashable, Sendable {
    let expression: String
    let label: String
  }

  /// Worked out by code from an expression (each working shown), or cited data.
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

/// Guess first, on a linear or log scale, before anything is explained, so the gap to the real
/// value is felt. Once checked, the guess locks and the real value shows on the same scale: worked
/// out by code with each step shown, or cited data. The comparison and the takeaway say why.
private struct GuessRevealCanvas: View {
  let fields: GuessRevealFields
  let context: ActivityCanvasContext

  var body: some View {
    let guess = context.answer?.number
    let actual: Double? =
      if case .checked = context.phase { checkAnswer ?? fields.trueValue } else { nil }

    VStack(alignment: .leading, spacing: 16) {
      ActivityGuessScaleView(
        scale: fields.guessScale, unit: fields.unit, guess: guess, actual: actual
      ) { value in
        context.setAnswer(.numeric(value))
      }

      if let actual {
        VStack(alignment: .leading, spacing: 10) {
          if let guess {
            comparisonText(GuessScale.compare(guess: guess, actual: actual, isCorrect: isCorrect))
              .font(.subheadline.weight(.semibold))
          }

          if let workings = fields.truth.workings, fields.truth.kind == "computed" {
            VStack(alignment: .leading, spacing: 4) {
              ForEach(Array(workings.enumerated()), id: \.offset) { _, working in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                  if let value = ActivityExpression.evaluate(working.expression) {
                    Text(ActivityNumberFormat.format(value))
                      .fontWeight(.semibold)
                      .monospacedDigit()
                  }
                  Text(working.label)
                    .foregroundStyle(.secondary)
                }
                .font(.subheadline)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
              }
            }
            .padding(12)
            .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12))
          }

          if let comparison = fields.comparison {
            LessonRichText(comparison)
              .font(.subheadline)
          }

          LessonRichText(fields.takeaway)
            .font(.subheadline)
            .foregroundStyle(.secondary)
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

  private func comparisonText(_ comparison: GuessScale.Comparison) -> Text {
    switch comparison {
    case .close:
      Text(
        "Your guess is close to the real value.", tableName: "Activities",
        comment: "After the check: the guess was close enough")
    case .tooBig(let times):
      Text(
        "Your guess is about \(ActivityNumberFormat.format(times)) times too big.",
        tableName: "Activities",
        comment: "After the check: how many times bigger the guess was than the real value")
    case .tooSmall(let times):
      Text(
        "Your guess is about \(ActivityNumberFormat.format(times)) times too small.",
        tableName: "Activities",
        comment: "After the check: how many times smaller the guess was than the real value")
    case .off(let difference):
      Text(
        "Your guess is off by \(ActivityNumberFormat.format(abs(difference), unit: fields.unit)).",
        tableName: "Activities",
        comment: "After the check: how far the guess was from the real value")
    }
  }
}
