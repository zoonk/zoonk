import Foundation
import SwiftUI

/// Mirrors main's `formatDuration`.
func progressLearningTime(_ totalSeconds: Int, locale: Locale = .autoupdatingCurrent) -> String {
  func unit(_ value: Int, _ unit: UnitDuration) -> String {
    Measurement(value: Double(value), unit: unit)
      .formatted(.measurement(width: .abbreviated, usage: .asProvided).locale(locale))
  }

  let seconds = max(totalSeconds, 0)

  if seconds == 0 {
    return unit(0, .minutes)
  }

  if seconds < 60 {
    return unit(seconds, .seconds)
  }

  let totalMinutes = Int((Double(seconds) / 60).rounded())

  if totalMinutes < 60 {
    return unit(totalMinutes, .minutes)
  }

  let hours = unit(totalMinutes / 60, .hours)
  let minutes = totalMinutes % 60
  return minutes == 0 ? hours : "\(hours) \(unit(minutes, .minutes))"
}

/// Mirrors main's `formatMetricPercent`; `value` is on the API's 0–100 scale.
func metricPercent(_ value: Double) -> String {
  (value / 100).formatted(
    .percent.precision(.fractionLength(0...1)).rounded(rule: .toNearestOrAwayFromZero))
}

func wholePercent(_ value: Double) -> String {
  (value / 100).formatted(
    .percent.precision(.fractionLength(0)).rounded(rule: .toNearestOrAwayFromZero))
}

extension ProgressBelt {
  var localizedTitle: LocalizedStringResource {
    switch self {
    case .white:
      LocalizedStringResource("White belt", table: "Progress", comment: "Name of the white belt")
    case .yellow:
      LocalizedStringResource("Yellow belt", table: "Progress", comment: "Name of the yellow belt")
    case .orange:
      LocalizedStringResource("Orange belt", table: "Progress", comment: "Name of the orange belt")
    case .green:
      LocalizedStringResource("Green belt", table: "Progress", comment: "Name of the green belt")
    case .blue:
      LocalizedStringResource("Blue belt", table: "Progress", comment: "Name of the blue belt")
    case .purple:
      LocalizedStringResource("Purple belt", table: "Progress", comment: "Name of the purple belt")
    case .brown:
      LocalizedStringResource("Brown belt", table: "Progress", comment: "Name of the brown belt")
    case .red:
      LocalizedStringResource("Red belt", table: "Progress", comment: "Name of the red belt")
    case .gray:
      LocalizedStringResource("Gray belt", table: "Progress", comment: "Name of the gray belt")
    case .black:
      LocalizedStringResource("Black belt", table: "Progress", comment: "Name of the black belt")
    }
  }

  var shortTitle: LocalizedStringResource {
    switch self {
    case .white:
      LocalizedStringResource(
        "White", table: "Progress", comment: "The white belt's color, under it on the belt rack")
    case .yellow:
      LocalizedStringResource(
        "Yellow", table: "Progress", comment: "The yellow belt's color, under it on the belt rack")
    case .orange:
      LocalizedStringResource(
        "Orange", table: "Progress", comment: "The orange belt's color, under it on the belt rack")
    case .green:
      LocalizedStringResource(
        "Green", table: "Progress", comment: "The green belt's color, under it on the belt rack")
    case .blue:
      LocalizedStringResource(
        "Blue", table: "Progress", comment: "The blue belt's color, under it on the belt rack")
    case .purple:
      LocalizedStringResource(
        "Purple", table: "Progress", comment: "The purple belt's color, under it on the belt rack")
    case .brown:
      LocalizedStringResource(
        "Brown", table: "Progress", comment: "The brown belt's color, under it on the belt rack")
    case .red:
      LocalizedStringResource(
        "Red", table: "Progress", comment: "The red belt's color, under it on the belt rack")
    case .gray:
      LocalizedStringResource(
        "Gray", table: "Progress", comment: "The gray belt's color, under it on the belt rack")
    case .black:
      LocalizedStringResource(
        "Black", table: "Progress", comment: "The black belt's color, under it on the belt rack")
    }
  }

  /// Artwork, at full strength in every mode.
  var color: Color {
    switch self {
    case .white:
      .white
    case .yellow:
      .yellow
    case .orange:
      .orange
    case .green:
      .green
    case .blue:
      .blue
    case .purple:
      .purple
    case .brown:
      .brown
    case .red:
      .red
    case .gray:
      .gray
    case .black:
      .black
    }
  }
}

extension ProgressDaypart {
  var localizedTitle: LocalizedStringResource {
    switch self {
    case .night:
      LocalizedStringResource(
        "Night", table: "Progress", comment: "The part of the day from midnight to 6 AM")
    case .morning:
      LocalizedStringResource(
        "Morning", table: "Progress", comment: "The part of the day from 6 AM to noon")
    case .afternoon:
      LocalizedStringResource(
        "Afternoon", table: "Progress", comment: "The part of the day from noon to 6 PM")
    case .evening:
      LocalizedStringResource(
        "Evening", table: "Progress", comment: "The part of the day from 6 PM to midnight")
    }
  }

  func localizedTimeRange(locale: Locale = .autoupdatingCurrent) -> String {
    let (start, end) = hours
    let clockFormat = DateFormatter.dateFormat(fromTemplate: "j", options: 0, locale: locale) ?? "H"

    guard clockFormat.contains("a") else {
      return String(format: "%02d–%02d", start, end)
    }

    var calendar = Calendar(identifier: .gregorian)
    calendar.locale = locale

    func clock(_ hour: Int) -> (hour: String, period: String) {
      let twelveHour = hour % 12 == 0 ? 12 : hour % 12
      return (
        twelveHour.formatted(.number.locale(locale)),
        hour % 24 < 12 ? calendar.amSymbol : calendar.pmSymbol
      )
    }

    let (from, to) = (clock(start), clock(end))

    return from.period == to.period
      ? "\(from.hour)–\(to.hour) \(to.period)"
      : "\(from.hour) \(from.period)–\(to.hour) \(to.period)"
  }

  private var hours: (start: Int, end: Int) {
    switch self {
    case .night:
      (0, 6)
    case .morning:
      (6, 12)
    case .afternoon:
      (12, 18)
    case .evening:
      (18, 24)
    }
  }
}

extension ProgressWeekday {
  /// Capitalized, as a name on its own reads ("Quinta-feira").
  func localizedTitle(locale: Locale = .autoupdatingCurrent) -> String {
    var calendar = Calendar(identifier: .gregorian)
    calendar.locale = locale
    let name = calendar.standaloneWeekdaySymbols[sundayIndex]
    return name.prefix(1).uppercased(with: locale) + name.dropFirst()
  }

  private var sundayIndex: Int {
    switch self {
    case .sunday:
      0
    case .monday:
      1
    case .tuesday:
      2
    case .wednesday:
      3
    case .thursday:
      4
    case .friday:
      5
    case .saturday:
      6
    }
  }
}

func bigQuantity(_ text: String) -> Text {
  var attributed = AttributedString()
  var remainder = Substring(text)
  let number = /[~≈+\-−]?\d[\d.,:]*(?:[\u{00A0}\u{202F}]?%)?/

  while let match = remainder.firstMatch(of: number) {
    var unit = AttributedString(remainder[remainder.startIndex..<match.range.lowerBound])
    unit.font = .subheadline.weight(.medium)
    unit.foregroundColor = .secondary
    attributed += unit
    attributed += AttributedString(remainder[match.range])
    remainder = remainder[match.range.upperBound...]
  }

  var tail = AttributedString(remainder)
  tail.font = .subheadline.weight(.medium)
  tail.foregroundColor = .secondary
  attributed += tail

  return Text(attributed)
}
