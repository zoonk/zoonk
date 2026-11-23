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

  func ticks(count: Int = 4) -> [Double] {
    if kind == .linear {
      let room = (max - min) * 0.08
      return [min]
        + ChartsAxis.ticks(min...max, count: count).filter { $0 - min > room && max - $0 > room }
        + [max]
    }
    let from = Int(ceil(log10(min)))
    let to = Int(floor(log10(max)))
    let powers = from <= to ? (from...to).map { pow(10, Double($0)) } : []
    let every = Int(ceil(Double(powers.count) / Double(count == 4 ? 6 : count)))
    return powers.count < 2
      ? [min, max] : powers.enumerated().filter { $0.offset % every == 0 }.map(\.element)
  }

  func tickFormatter(unit: String?, locale: Locale = .appLanguage) -> (Double) -> String {
    let currency = ActivityNumberFormat.currencyUnit(unit)
    let compact = ChartsAxis.isShort([min, max]) { value, compact in
      ActivityNumberFormat.format(value, unit: currency, compact: compact, locale: locale)
    }
    return { value in
      ActivityNumberFormat.format(
        value, unit: currency, digits: compact && currency != nil ? 1 : nil, compact: compact,
        locale: locale)
    }
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

  static func compare(
    guess: Double, actual: Double, isCorrect: Bool, unit: String? = nil
  ) -> Comparison {
    if isCorrect {
      return .close
    }

    if guess > 0, actual > 0 {
      let ratio = guess / actual
      if ratio >= 1.5 {
        return .tooBig(roundGuess(ratio))
      }
      if ratio <= 1 / 1.5 {
        return .tooSmall(roundGuess(1 / ratio))
      }
    }

    return .off(
      ActivityNumberFormat.roundedForDisplay(guess, unit: unit)
        - ActivityNumberFormat.roundedForDisplay(actual, unit: unit))
  }
}

func guessUnitLabel(_ unit: String?) -> Text? {
  guard let unit, !unit.isEmpty, ActivityNumberFormat.currencyUnit(unit) == nil else { return nil }
  return Text(
    "Unit: \(unit)", tableName: "Activities",
    comment:
      "Labels a scale's numbers with what they count or measure; {unit} is the activity's own unit text, such as days, km/h or times."
  )
}

struct ActivityGuessScaleView: View {
  let scale: GuessScale
  let unit: String?
  let guess: Double?
  /// The real value, known before Check so its row holds the room it takes once revealed.
  let actual: Double?
  let isRevealed: Bool
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
      .typeStyle(.readout)
      .accessibilityValue(guessUnitLabel(unit) ?? Text(verbatim: ""))

      // The real value's row and the revealed bar hold their room from the start, so nothing
      // moves on Check.
      if let actual {
        Text(
          "Real value: \(format(actual))", tableName: "Activities",
          comment: "The real value revealed after a guess"
        )
        .typeStyle(.readout)
        .foregroundStyle(Color.successText)
        .opacity(isRevealed ? 1 : 0)
        .accessibilityHidden(!isRevealed)
        .accessibilityValue(guessUnitLabel(unit) ?? Text(verbatim: ""))
      }

      if let label = guessUnitLabel(unit) { ActivityCaption(label) }

      ZStack {
        Slider(
          value: Binding(
            get: { (guess.map(scale.share(of:)) ?? 0.5) * GuessScale.positions },
            set: { onGuess(GuessScale.roundGuess(scale.value(atPosition: $0))) }),
          in: 0...GuessScale.positions, step: 1
        ) {
          Text(
            "Your guess", tableName: "Activities",
            comment: "VoiceOver: the slider the learner guesses with")
        }
        .accessibilityValue(
          guess.map {
            Text(verbatim: format($0))
              + (guessUnitLabel(unit).map { Text(verbatim: ". ") + $0 } ?? Text(verbatim: ""))
          }
            ?? Text(
              "No guess yet", tableName: "Activities",
              comment: "VoiceOver: a guess slider not moved yet")
        )
        .opacity(isRevealed ? 0 : 1)
        .disabled(isRevealed)
        .accessibilityHidden(isRevealed)

        if let actual {
          GuessScaleBar(
            guessShare: guess.map(scale.share(of:)), actualShare: scale.share(of: actual)
          )
          .opacity(isRevealed ? 1 : 0)
          .accessibilityHidden(true)
        }
      }

      GuessScaleAxis(scale: scale, unit: unit)
    }
  }

  private func format(_ value: Double) -> String {
    ActivityNumberFormat.guess(value, unit: unit)
  }
}

private struct GuessScaleAxis: View {
  /// The scale's end labels hold the track's ends, so the room between labels is kept wide enough
  /// that the last two still read apart.
  private static let labelGap = 16.0

  let scale: GuessScale
  let unit: String?
  @Environment(\.dynamicTypeSize) private var textSize
  @Environment(\.legibilityWeight) private var legibility
  var body: some View {
    let font = TypeStyle.data.uiFont(textSize, legibility: legibility)
    return GeometryReader { geometry in
      axis(width: geometry.size.width, font: font)
    }.frame(height: font.lineHeight + 8).accessibilityHidden(true)
  }
  private func axis(width: Double, font: UIFont) -> some View {
    let format = scale.tickFormatter(unit: unit)
    func left(_ value: Double) -> Double {
      let textWidth = (format(value) as NSString).size(withAttributes: [.font: font]).width
      return Swift.max(
        0, Swift.min(scale.share(of: value) * width - textWidth / 2, width - textWidth))
    }
    let ticks = ChartsAxis.fittingTicks(
      scale.min...scale.max, gap: Self.labelGap,
      frame: { value in
        let start = left(value)
        let textWidth = (format(value) as NSString).size(withAttributes: [.font: font]).width
        return (left: start, right: start + textWidth)
      }, values: { scale.ticks(count: $0) })
    return VStack(spacing: 4) {
      Canvas { context, size in
        for tick in ticks {
          let x = scale.share(of: tick) * size.width
          context.fill(Path(CGRect(x: x - 0.5, y: 0, width: 1, height: 4)), with: .color(.vizGrid))
        }
      }
      .frame(height: 4)

      ZStack(alignment: .topLeading) {
        ForEach(ticks, id: \.self) { value in
          Text(verbatim: format(value)).typeStyle(.data).foregroundStyle(.mutedForeground)
            .fixedSize().offset(x: left(value))
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
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
      let radius = height / 3

      // Main's reveal: the real value's dot sits in a soft ring under the learner's guess, so a guess
      // right on it still shows, and the ring still marks the real value around it.
      marker(context, x: actualX, y: y, radius: radius + 4, color: Color.success.opacity(0.2))
      marker(context, x: actualX, y: y, radius: radius, color: .success)

      if let guessShare {
        let guessX = size.width * guessShare
        let gap = CGRect(x: min(guessX, actualX), y: y - 3, width: abs(guessX - actualX), height: 6)
        context.fill(Path(gap), with: .color(Color.success.opacity(0.35)))
        marker(context, x: guessX, y: y, radius: radius + 2, color: Color(.systemBackground))
        marker(context, x: guessX, y: y, radius: radius, color: .primary)
      }
    }
    .frame(height: height)
  }

  private func marker(
    _ context: GraphicsContext, x: Double, y: Double, radius: Double, color: Color
  ) {
    context.fill(
      Path(ellipseIn: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)),
      with: .color(color))
  }
}
