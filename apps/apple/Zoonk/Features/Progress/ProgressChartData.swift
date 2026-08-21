import Foundation

struct ProgressContributionPoint: Equatable, Identifiable, Sendable {
  let date: ProgressDate
  let intensity: Int
  let value: Double?

  var id: ProgressDate { date }

  init(date: ProgressDate, intensity: Int, value: Double? = nil) {
    self.date = date
    self.intensity = intensity
    self.value = value
  }
}

struct ProgressContributionSlot: Equatable, Identifiable, Sendable {
  let date: ProgressDate
  let point: ProgressContributionPoint?

  var id: ProgressDate { date }
}

struct ProgressContributionWeek: Equatable, Identifiable, Sendable {
  let slots: [ProgressContributionSlot]
  let startDate: ProgressDate

  var id: ProgressDate { startDate }

  var monthLabelDate: ProgressDate? {
    slots.first { $0.date.day == 1 }?.date
  }
}

enum ProgressChartData {
  static let activityMaximumIntensity = 4
  static let energyMaximumIntensity = 5

  static func activityContributions(
    from days: [ActivityProgressDay]
  ) -> [ProgressContributionPoint] {
    let maximumLessonCompletions = max(0, days.map(\.lessonCompletions).max() ?? 0)

    return days.map { day in
      ProgressContributionPoint(
        date: day.date,
        intensity: activityIntensity(
          lessonCompletions: day.lessonCompletions,
          maximumLessonCompletions: maximumLessonCompletions),
        value: Double(day.lessonCompletions))
    }
  }

  static func energyContributions(
    from days: [EnergyProgressDay]
  ) -> [ProgressContributionPoint] {
    days.map { day in
      ProgressContributionPoint(
        date: day.date,
        intensity: energyIntensity(day.energy),
        value: day.energy)
    }
  }

  static func contributionWeeks(
    from points: [ProgressContributionPoint]
  ) -> [ProgressContributionWeek] {
    let sortedPoints = points.sorted { $0.date < $1.date }

    guard let firstDate = sortedPoints.first?.date, let lastDate = sortedPoints.last?.date else {
      return []
    }

    let pointByDate = Dictionary(
      sortedPoints.map { ($0.date, $0) },
      uniquingKeysWith: { _, latest in latest })
    let slots = contributionDates(from: weekStart(containing: firstDate), through: lastDate).map {
      ProgressContributionSlot(date: $0, point: pointByDate[$0])
    }

    return stride(from: 0, to: slots.count, by: 7).map { startIndex in
      let endIndex = min(startIndex + 7, slots.count)
      let weekSlots = Array(slots[startIndex..<endIndex])

      return ProgressContributionWeek(
        slots: weekSlots,
        startDate: weekSlots[0].date)
    }
  }

  private static func activityIntensity(
    lessonCompletions: Int,
    maximumLessonCompletions: Int
  ) -> Int {
    guard lessonCompletions > 0, maximumLessonCompletions > 0 else {
      return 0
    }

    let relativeIntensity = ceil(
      Double(lessonCompletions) / Double(maximumLessonCompletions)
        * Double(activityMaximumIntensity))

    return min(max(Int(relativeIntensity), 1), activityMaximumIntensity)
  }

  private static func energyIntensity(_ energy: Double?) -> Int {
    guard let energy, energy > 0 else {
      return 0
    }

    if energy >= 100 {
      return energyMaximumIntensity
    }

    return min(max(Int(ceil(energy / 25)), 1), energyMaximumIntensity - 1)
  }

  private static func weekStart(containing date: ProgressDate) -> ProgressDate {
    guard let foundationDate = date.date(in: utcTimeZone) else {
      preconditionFailure("A valid progress date must convert to a Foundation date")
    }

    let daysSinceSunday = utcCalendar.component(.weekday, from: foundationDate) - 1

    guard
      let weekStart = utcCalendar.date(
        byAdding: .day,
        value: -daysSinceSunday,
        to: foundationDate)
    else {
      preconditionFailure("A valid progress date must have a calendar week start")
    }

    return progressDate(from: weekStart)
  }

  private static func contributionDates(
    from startDate: ProgressDate,
    through endDate: ProgressDate
  ) -> [ProgressDate] {
    guard
      let start = startDate.date(in: utcTimeZone),
      let end = endDate.date(in: utcTimeZone),
      let dayCount = utcCalendar.dateComponents([.day], from: start, to: end).day
    else {
      preconditionFailure("Valid progress dates must define a calendar range")
    }

    return (0...max(dayCount, 0)).map { dayOffset in
      guard let date = utcCalendar.date(byAdding: .day, value: dayOffset, to: start) else {
        preconditionFailure("A valid calendar range must contain every intermediate day")
      }

      return progressDate(from: date)
    }
  }

  private static func progressDate(from date: Date) -> ProgressDate {
    let components = utcCalendar.dateComponents([.year, .month, .day], from: date)

    guard
      let year = components.year,
      let month = components.month,
      let day = components.day,
      let progressDate = ProgressDate(String(format: "%04d-%02d-%02d", year, month, day))
    else {
      preconditionFailure("A valid Foundation date must convert to a progress date")
    }

    return progressDate
  }

  private static var utcCalendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = utcTimeZone
    return calendar
  }

  private static var utcTimeZone: TimeZone {
    TimeZone(secondsFromGMT: 0)!
  }
}
