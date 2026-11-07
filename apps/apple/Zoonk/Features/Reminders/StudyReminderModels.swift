import Foundation

/// One reminder a day, by email, by push to one chosen phone, or both.
struct StudyReminder: Equatable, Sendable {
  struct Phone: Equatable, Sendable {
    let label: String
    let token: String
  }

  /// "HH:MM" in `timeZone`.
  var time: String
  /// The active goal's zone.
  let timeZone: String
  var emailOn: Bool
  /// Nil for a guest, who needs an account for email.
  let emailAddress: String?
  var pushOn: Bool
  var phone: Phone?
  /// A channel is on, but reminders wait until the learner studies again.
  let quiet: Bool
}

/// After a plan lesson, while no reminder is on and none was offered before.
struct ReminderOffer: Decodable, Hashable, Sendable {
  let time: String
  let timeZone: String
}

/// What a save changes; the rest stays as the server has it.
struct StudyReminderChange: Equatable, Sendable {
  var time: String?
  var emailOn: Bool?
  var pushOn: Bool?

  func applied(to reminder: StudyReminder) -> StudyReminder {
    var next = reminder
    next.time = time ?? next.time
    next.emailOn = emailOn ?? next.emailOn
    next.pushOn = pushOn ?? next.pushOn
    return next
  }
}

/// Reminder times are wall-clock times in the learner's zone, so they're read and written in GMT,
/// where every minute of every day exists, and shown in GMT too. Reminders go out every 15 minutes,
/// so a picked time rounds to the nearest quarter hour, the one it arrives at.
enum ReminderTime {
  private static var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .gmt
    return calendar
  }

  static func date(_ time: String) -> Date {
    let parts = time.split(separator: ":").compactMap { Int($0) }
    let components = DateComponents(
      year: 2000, month: 1, day: 1, hour: parts.first ?? 19, minute: parts.dropFirst().first ?? 0)
    return calendar.date(from: components) ?? .distantPast
  }

  static func string(_ date: Date) -> String {
    let components = calendar.dateComponents([.hour, .minute], from: date)
    let quarters = ((components.hour ?? 19) * 60 + (components.minute ?? 0) + 7) / 15
    let minutes = quarters * 15 % (24 * 60)
    return String(format: "%02d:%02d", minutes / 60, minutes % 60)
  }

  static func rounded(_ time: String) -> String {
    string(date(time))
  }

  /// The zone reminders follow, named the system's way, as in “Brasília Time”.
  static func zoneName(_ identifier: String) -> String {
    TimeZone(identifier: identifier)?.localizedName(for: .generic, locale: .current) ?? identifier
  }

  static func formatted(_ time: String) -> String {
    date(time).formatted(Date.FormatStyle(date: .omitted, time: .shortened, timeZone: .gmt))
  }
}

extension StudyReminder {
  init(_ reminder: Components.Schemas.StudyReminder) {
    self.init(
      time: reminder.time,
      timeZone: reminder.timeZone,
      emailOn: reminder.email.on,
      emailAddress: reminder.email.address,
      pushOn: reminder.push.on,
      phone: reminder.push.phone.map { Phone(label: $0.label, token: $0.token) },
      quiet: reminder.quiet)
  }
}
