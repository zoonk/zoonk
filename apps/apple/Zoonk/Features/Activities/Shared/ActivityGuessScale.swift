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

  func tickLabels(unit: String?, locale: Locale = .courseLanguage) -> [String] {
    let currency = ActivityNumberFormat.currencyUnit(unit)
    let values = [min, max]
    let compact = values.contains {
      ActivityNumberFormat.format($0, unit: currency, locale: locale).count > 8
    }
    return values.map {
      ActivityNumberFormat.format(
        $0, unit: currency, digits: compact && currency != nil ? 1 : nil, compact: compact,
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

func guessUnitLabel(_ unit: String?) -> Text? {
  guard let unit, !unit.isEmpty, ActivityNumberFormat.currencyUnit(unit) == nil else { return nil }
  return Text(
    "in \(unit)", tableName: "Activities",
    comment:
      "Labels a group of numbers with the unit the activity measures in; {unit} is the activity's own unit text, such as days or km/h"
  )
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
      .typeStyle(.readout)
      .accessibilityValue(guessUnitLabel(unit) ?? Text(verbatim: ""))

      if let label = guessUnitLabel(unit) { ActivityCaption(label) }

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
        }
        .accessibilityValue(
          guess.map {
            Text(verbatim: format($0))
              + (guessUnitLabel(unit).map { Text(verbatim: ". ") + $0 } ?? Text(verbatim: ""))
          }
            ?? Text(
              "No guess yet", tableName: "Activities",
              comment: "VoiceOver: a guess slider not moved yet"))
        GuessScaleAxis(scale: scale, unit: unit)
      }
    }
  }

  private func revealed(actual: Double) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      GuessScaleBar(
        guessShare: guess.map(scale.share(of:)), actualShare: scale.share(of: actual)
      )
      .accessibilityHidden(true)

      GuessScaleAxis(scale: scale, unit: unit)

      Text(
        "Real value: \(format(actual))", tableName: "Activities",
        comment: "The real value revealed after a guess"
      )
      .typeStyle(.body.weight(.semibold).monospaced())
      .foregroundStyle(Color.successText)
      .accessibilityValue(guessUnitLabel(unit) ?? Text(verbatim: ""))
    }
  }

  private func format(_ value: Double) -> String {
    ActivityNumberFormat.guess(value, unit: unit)
  }
}

private struct GuessScaleAxis: View {
  let scale: GuessScale
  let unit: String?
  @Environment(\.dynamicTypeSize) private var textSize
  @Environment(\.legibilityWeight) private var legibility
  var body: some View {
    let font = TypeStyle.data.uiFont(textSize, legibility: legibility)
    return GeometryReader { geometry in
      axis(width: geometry.size.width, font: font)
    }.frame(height: font.lineHeight).accessibilityHidden(true)
  }
  private func axis(width: Double, font: UIFont) -> some View {
    let money = ActivityNumberFormat.currencyUnit(unit)
    let compact = [scale.min, scale.max].contains {
      ActivityNumberFormat.format($0, unit: money).count > 8
    }
    let format: (Double) -> String = {
      ActivityNumberFormat.format(
        $0, unit: money, digits: compact && money != nil ? 1 : nil, compact: compact)
    }
    func left(_ value: Double) -> Double {
      let textWidth = (format(value) as NSString).size(withAttributes: [.font: font]).width
      return Swift.max(
        0, Swift.min(scale.share(of: value) * width - textWidth / 2, width - textWidth))
    }
    let ticks = ChartsAxis.fittingTicks(
      scale.min...scale.max,
      frame: { value in
        let start = left(value)
        let textWidth = (format(value) as NSString).size(withAttributes: [.font: font]).width
        return (left: start, right: start + textWidth)
      }, values: { scale.ticks(count: $0) })
    return ZStack(alignment: .topLeading) {
      ForEach(ticks, id: \.self) { value in
        Text(verbatim: format(value)).typeStyle(.data).foregroundStyle(.mutedForeground).fixedSize()
          .offset(x: left(value))
      }
    }.frame(maxWidth: .infinity, alignment: .leading)
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
