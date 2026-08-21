import Foundation
import SwiftUI

func progressLearningTime(
  _ totalSeconds: Int,
  locale: Locale = .autoupdatingCurrent
) -> String {
  let seconds = max(totalSeconds, 0)

  if seconds == 0 {
    return Duration.seconds(0).formatted(
      .units(
        allowed: [.minutes],
        width: .abbreviated,
        maximumUnitCount: 1,
        zeroValueUnits: .show(length: 1)
      )
      .locale(locale))
  }

  if seconds < 60 {
    return Duration.seconds(seconds).formatted(
      .units(
        allowed: [.seconds],
        width: .abbreviated,
        maximumUnitCount: 1
      )
      .locale(locale))
  }

  return Duration.seconds(seconds).formatted(
    .units(
      allowed: [.hours, .minutes],
      width: .abbreviated,
      maximumUnitCount: 2
    )
    .locale(locale))
}

extension EnergyProgress {
  var displayedCurrentEnergy: Double {
    currentEnergy.rounded()
  }
}

extension LevelProgress {
  var progressTotal: Double {
    Double(max(bpPerLevel, 1))
  }

  var progressValue: Double {
    if isMaxLevel {
      return progressTotal
    }

    return Double(min(max(progressInLevel, 0), max(bpPerLevel, 1)))
  }
}

extension ProgressBelt {
  var localizedTitle: LocalizedStringResource {
    switch self {
    case .white:
      LocalizedStringResource(
        "White Belt",
        table: "Progress",
        comment: "Name of the white learning belt.")
    case .yellow:
      LocalizedStringResource(
        "Yellow Belt",
        table: "Progress",
        comment: "Name of the yellow learning belt.")
    case .orange:
      LocalizedStringResource(
        "Orange Belt",
        table: "Progress",
        comment: "Name of the orange learning belt.")
    case .green:
      LocalizedStringResource(
        "Green Belt",
        table: "Progress",
        comment: "Name of the green learning belt.")
    case .blue:
      LocalizedStringResource(
        "Blue Belt",
        table: "Progress",
        comment: "Name of the blue learning belt.")
    case .purple:
      LocalizedStringResource(
        "Purple Belt",
        table: "Progress",
        comment: "Name of the purple learning belt.")
    case .brown:
      LocalizedStringResource(
        "Brown Belt",
        table: "Progress",
        comment: "Name of the brown learning belt.")
    case .red:
      LocalizedStringResource(
        "Red Belt",
        table: "Progress",
        comment: "Name of the red learning belt.")
    case .gray:
      LocalizedStringResource(
        "Gray Belt",
        table: "Progress",
        comment: "Name of the gray learning belt.")
    case .black:
      LocalizedStringResource(
        "Black Belt",
        table: "Progress",
        comment: "Name of the black learning belt.")
    }
  }

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

  var accentColor: Color {
    switch self {
    case .white, .black:
      .primary
    case .yellow, .orange:
      .brown
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
      .secondary
    }
  }

  var progressColor: Color {
    switch self {
    case .white, .gray:
      .gray
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
    case .black:
      .primary
    }
  }
}

extension ProgressDaypart {
  var localizedTitle: LocalizedStringResource {
    switch self {
    case .night:
      LocalizedStringResource(
        "Night",
        table: "Progress",
        comment: "Name of the midnight-to-morning score period")
    case .morning:
      LocalizedStringResource(
        "Morning",
        table: "Progress",
        comment: "Name of the morning score period")
    case .afternoon:
      LocalizedStringResource(
        "Afternoon",
        table: "Progress",
        comment: "Name of the afternoon score period")
    case .evening:
      LocalizedStringResource(
        "Evening",
        table: "Progress",
        comment: "Name of the evening score period")
    }
  }

  var systemImage: String {
    switch self {
    case .night:
      "moon.stars"
    case .morning:
      "sunrise"
    case .afternoon:
      "sun.max"
    case .evening:
      "moon"
    }
  }

  var localizedTimeRange: String {
    localizedTimeRange(locale: .autoupdatingCurrent)
  }

  func localizedTimeRange(locale: Locale) -> String {
    let timeZone = TimeZone(secondsFromGMT: 0)!
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone
    let startOfDay = Date(timeIntervalSinceReferenceDate: 0)
    let startDate = calendar.date(byAdding: .hour, value: startHour, to: startOfDay)!
    let endDate = calendar.date(byAdding: .hour, value: endHour, to: startOfDay)!
    let formatter = DateFormatter()
    formatter.calendar = calendar
    formatter.locale = locale
    formatter.timeZone = timeZone
    formatter.dateStyle = .none
    formatter.timeStyle = .short
    return "\(formatter.string(from: startDate))–\(formatter.string(from: endDate))"
  }

  private var startHour: Int {
    switch self {
    case .night:
      0
    case .morning:
      6
    case .afternoon:
      12
    case .evening:
      18
    }
  }

  private var endHour: Int {
    switch self {
    case .night:
      6
    case .morning:
      12
    case .afternoon:
      18
    case .evening:
      24
    }
  }
}

extension ProgressWeekday {
  var localizedTitle: String {
    weekdayName(from: DateFormatter().weekdaySymbols)
  }

  var shortLocalizedTitle: String {
    weekdayName(from: DateFormatter().veryShortWeekdaySymbols)
  }

  var order: Int {
    order(in: .autoupdatingCurrent)
  }

  func order(in calendar: Calendar) -> Int {
    (foundationWeekdayIndex - (calendar.firstWeekday - 1) + Self.allCases.count)
      % Self.allCases.count
  }

  private var foundationWeekdayIndex: Int {
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

  private func weekdayName(from names: [String]) -> String {
    names.indices.contains(foundationWeekdayIndex)
      ? names[foundationWeekdayIndex] : rawValue.capitalized
  }
}
