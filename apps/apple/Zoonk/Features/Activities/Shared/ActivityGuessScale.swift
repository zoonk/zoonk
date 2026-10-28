import SwiftUI

/// Mirrors main's `guess-scale`: a guess reads as a guess (two significant digits).
struct GuessScale: Hashable, Sendable {
  enum Kind: String, Decodable, Hashable, Sendable {
    case linear, log
  }

  /// Slider positions along the scale: fine enough to feel continuous, coarse enough for arrows.
  static let positions = 200.0

  let min: Double
  let max: Double
  let kind: Kind

  func value(atPosition position: Double) -> Double {
    let share = Swift.min(Swift.max(position, 0), Self.positions) / Self.positions

    if kind == .log {
      return pow(10, log10(min) + (log10(max) - log10(min)) * share)
    }

    return min + (max - min) * share
  }

  func share(of value: Double) -> Double {
    let share =
      kind == .log
      ? (log10(Swift.max(value, min)) - log10(min)) / (log10(max) - log10(min))
      : max == min ? 0 : (value - min) / (max - min)

    return Swift.min(Swift.max(share, 0), 1)
  }

  static func roundGuess(_ value: Double) -> Double {
    FactChange.twoDigits(value)
  }

  enum Comparison: Hashable {
    case close
    case tooBig(Double)
    case tooSmall(Double)
    case off(Double)
  }

  static func compare(guess: Double, actual: Double, isCorrect: Bool) -> Comparison {
    if isCorrect {
      return .close
    }

    guard guess > 0, actual > 0 else {
      return .off(guess - actual)
    }

    let ratio = guess / actual

    if ratio >= 1.5 {
      return .tooBig(roundGuess(ratio))
    }

    return ratio <= 1 / 1.5 ? .tooSmall(roundGuess(1 / ratio)) : .off(guess - actual)
  }
}

struct ActivityGuessScaleView: View {
  let scale: GuessScale
  let unit: String?
  let guess: Double?
  let actual: Double?
  let onGuess: (Double) -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Group {
        if let guess {
          Text(
            "Your guess: \(format(guess))", tableName: "Activities",
            comment: "The learner's guess on a scale")
        } else {
          Text(
            "Drag to guess", tableName: "Activities",
            comment: "Before the learner guesses on a scale")
        }
      }
      .font(.title3.weight(.semibold).monospacedDigit())

      if let actual {
        revealed(actual: actual)
      } else {
        Slider(
          value: Binding(
            get: { (guess.map(scale.share(of:)) ?? 0.5) * GuessScale.positions },
            set: { onGuess(GuessScale.roundGuess(scale.value(atPosition: $0))) }),
          in: 0...GuessScale.positions, step: 1
        ) {
          Text(
            "Your guess", tableName: "Activities",
            comment: "VoiceOver: the slider the learner guesses with")
        } minimumValueLabel: {
          Text(format(scale.min)).font(.caption.monospacedDigit())
        } maximumValueLabel: {
          Text(format(scale.max)).font(.caption.monospacedDigit())
        }
        .accessibilityValue(
          guess.map { Text(verbatim: format($0)) }
            ?? Text(
              "No guess yet", tableName: "Activities",
              comment: "VoiceOver: a guess slider not moved yet"))
      }
    }
  }

  private func revealed(actual: Double) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      GuessScaleBar(
        guessShare: guess.map(scale.share(of:)), actualShare: scale.share(of: actual)
      )
      .accessibilityHidden(true)

      HStack {
        Text(format(scale.min))
        Spacer()
        Text(format(scale.max))
      }
      .font(.caption.monospacedDigit())
      .foregroundStyle(.secondary)
      .accessibilityHidden(true)

      Text(
        "Real value: \(format(actual))", tableName: "Activities",
        comment: "The real value revealed after a guess"
      )
      .font(.headline.monospacedDigit())
      .foregroundStyle(Color.success)
    }
  }

  private func format(_ value: Double) -> String {
    ActivityNumberFormat.format(value, unit: unit)
  }
}

private struct GuessScaleBar: View {
  let guessShare: Double?
  let actualShare: Double

  @ScaledMetric(relativeTo: .body) private var height = 28.0

  var body: some View {
    Canvas { context, size in
      let y = size.height / 2
      let track = Path(
        roundedRect: CGRect(x: 0, y: y - 3, width: size.width, height: 6), cornerRadius: 3)
      context.fill(track, with: .color(Color(.systemFill)))

      let actualX = size.width * actualShare

      if let guessShare {
        let guessX = size.width * guessShare
        let gap = CGRect(x: min(guessX, actualX), y: y - 3, width: abs(guessX - actualX), height: 6)
        context.fill(Path(gap), with: .color(Color.success.opacity(0.35)))
        marker(context, x: guessX, y: y, color: .primary)
      }

      marker(context, x: actualX, y: y, color: .success)
    }
    .frame(height: height)
  }

  private func marker(_ context: GraphicsContext, x: Double, y: Double, color: Color) {
    let radius = height / 3
    context.fill(
      Path(ellipseIn: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)),
      with: .color(color))
  }
}
