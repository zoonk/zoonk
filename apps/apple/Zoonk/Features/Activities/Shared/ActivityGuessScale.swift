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

  var ticks: [Double] {
    if kind == .linear {
      let room = (max - min) * 0.08
      return [min]
        + ChartsAxis.ticks(min...max).filter {
          $0 - min > room && max - $0 > room
        } + [max]
    }

    let first = ceil(log10(min))
    let last = floor(log10(max))
    let powers = (0..<Swift.max(Int(last - first + 1), 0)).map { pow(10, first + Double($0)) }
    guard powers.count >= 2 else { return [min, max] }
    let every = Int(ceil(Double(powers.count) / 6))
    return powers.enumerated().compactMap { $0.offset % every == 0 ? $0.element : nil }
  }

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

  func tickLabel(_ tick: Double, unit: String?, locale: Locale = .courseLanguage) -> String {
    let isMoney = unit.map(ActivityNumberFormat.isMoney) ?? false
    let isShort = ChartsAxis.isShort(ticks) { value, compact in
      ActivityNumberFormat.format(
        value, unit: isMoney ? unit : nil, compact: compact, locale: locale)
    }
    return ActivityNumberFormat.format(
      tick, unit: isMoney || tick == ticks.last ? unit : nil, compact: isShort, locale: locale)
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
      .typeStyle(.body.weight(.medium).monospacedDigit())
      .foregroundStyle(.mutedForeground)

      if let actual {
        revealed(actual: actual)
      } else {
        // Positions snap here rather than with a step, which would draw a row of ticks under the
        // track.
        Slider(
          value: Binding(
            get: { (guess.map(scale.share(of:)) ?? 0.5) * GuessScale.positions },
            set: { onGuess(GuessScale.roundGuess(scale.value(atPosition: $0.rounded()))) }),
          in: 0...GuessScale.positions
        ) {
          Text(
            "Your guess", tableName: "Activities",
            comment: "VoiceOver: the slider the learner guesses with")
        }
        .accessibilityValue(
          guess.map { Text(verbatim: format($0)) }
            ?? Text(
              "No guess yet", tableName: "Activities",
              comment: "VoiceOver: a guess slider not moved yet"))

        tickLabels
      }
    }
  }

  private func revealed(actual: Double) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      GuessScaleBar(
        guessShare: guess.map(scale.share(of:)), actualShare: scale.share(of: actual)
      )
      .accessibilityHidden(true)

      tickLabels

      Text(
        "Real value: \(format(actual))", tableName: "Activities",
        comment: "The real value revealed after a guess"
      )
      .typeStyle(.body.weight(.semibold).monospaced())
      .foregroundStyle(Color.successText)
    }
  }

  private var tickLabels: some View {
    let ticks = scale.ticks
    return VStack(spacing: 4) {
      Canvas { context, size in
        for tick in ticks {
          let x = scale.share(of: tick) * size.width
          context.fill(Path(CGRect(x: x - 0.5, y: 0, width: 1, height: 4)), with: .color(.vizGrid))
        }
      }
      .frame(height: 4)

      GuessTickLayout(positions: ticks.map(scale.share(of:))) {
        ForEach(ticks, id: \.self) { tick in
          Text(verbatim: scale.tickLabel(tick, unit: unit))
            .typeStyle(.meta.monospacedDigit())
            .foregroundStyle(.mutedForeground)
        }
      }
    }
  }

  private func format(_ value: Double) -> String {
    ActivityNumberFormat.format(value, unit: unit)
  }
}

private struct GuessTickLayout: Layout {
  let positions: [Double]

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    CGSize(
      width: proposal.width ?? 0,
      height: subviews.map { $0.sizeThatFits(.unspecified).height }.max() ?? 0)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    for (view, share) in zip(subviews, positions) {
      let width = view.sizeThatFits(.unspecified).width
      let x = share * bounds.width
      let anchor = ChartsAxis.anchor(at: x, plotWidth: bounds.width, labelWidth: width)
      view.place(
        at: CGPoint(x: bounds.minX + x, y: bounds.minY), anchor: anchor, proposal: .unspecified)
    }
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
      context.fill(track, with: .color(Color.surface3))

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
