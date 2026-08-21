import Foundation

/// Preserves the API's learner-local calendar day without treating it as a timezone-shifting instant.
struct ProgressDate: Codable, Comparable, Hashable, Identifiable, Sendable {
  let day: Int
  let month: Int
  let year: Int

  var id: String { rawValue }

  private var rawValue: String {
    String(format: "%04d-%02d-%02d", year, month, day)
  }

  init?(_ rawValue: String) {
    let components = rawValue.split(separator: "-", omittingEmptySubsequences: false)

    guard
      rawValue.count == 10,
      components.count == 3,
      components[0].count == 4,
      components[1].count == 2,
      components[2].count == 2,
      let year = Int(components[0]),
      let month = Int(components[1]),
      let day = Int(components[2]),
      Self.isValid(year: year, month: month, day: day)
    else {
      return nil
    }

    self.day = day
    self.month = month
    self.year = year
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.singleValueContainer()
    let rawValue = try container.decode(String.self)

    guard let date = ProgressDate(rawValue) else {
      throw DecodingError.dataCorruptedError(
        in: container,
        debugDescription: "Expected a valid YYYY-MM-DD calendar date")
    }

    self = date
  }

  func encode(to encoder: any Encoder) throws {
    var container = encoder.singleValueContainer()
    try container.encode(rawValue)
  }

  func date(in timeZone: TimeZone = .autoupdatingCurrent) -> Date? {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = timeZone

    return calendar.date(
      from: DateComponents(
        timeZone: timeZone,
        year: year,
        month: month,
        day: day,
        hour: 12))
  }

  static func < (lhs: ProgressDate, rhs: ProgressDate) -> Bool {
    (lhs.year, lhs.month, lhs.day) < (rhs.year, rhs.month, rhs.day)
  }

  private static func isValid(year: Int, month: Int, day: Int) -> Bool {
    guard year > 0 else {
      return false
    }

    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    let components = DateComponents(year: year, month: month, day: day, hour: 12)

    guard let date = calendar.date(from: components) else {
      return false
    }

    return calendar.dateComponents([.year, .month, .day], from: date)
      == DateComponents(year: year, month: month, day: day)
  }
}
