import SwiftUI

/// Main's `GateWords`: what stopped, and at most one line under it.
struct GateWords: View {
  var title: Text?
  var line: Text?

  /// A wide bottom bar's note ends with its buttons.
  @Environment(\.multilineTextAlignment) private var textAlignment

  private var alignment: HorizontalAlignment { textAlignment == .trailing ? .trailing : .leading }

  var body: some View {
    VStack(alignment: alignment, spacing: 2) {
      if let title {
        title
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))
      }

      if let line {
        // A short break's wait counts down here without the line changing width.
        line
          .typeStyle(.body)
          .monospacedDigit()
          .foregroundStyle(.mutedForeground)
      }
    }
    .fixedSize(horizontal: false, vertical: true)
    .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .center))
  }
}

/// The one action that leads to paying, wherever it shows.
struct SubscribeButton: View {
  @Environment(AppRouter.self) private var router

  /// Replaces opening the subscription here, where the screen must close first.
  var action: (() -> Void)?

  var body: some View {
    Button {
      if let action {
        action()
      } else {
        router.present(.subscription)
      }
    } label: {
      Text(
        "Subscribe", tableName: "Subscriptions",
        comment: "Opens the subscription from a feature or limit that needs one")
    }
    .onAppear {
      UsageAnalytics.track(.subscriptionGateShown)
    }
  }
}

/// Main's `SubscribeGate`: in place of what the learner tried, what stopped as the title, at most
/// one line, and "Subscribe". Nothing announces it before the try. `action` is a second way on
/// that isn't paying, such as their Plan.
struct SubscribeGate<Action: View>: View {
  let title: Text
  var line: Text?
  @ViewBuilder var action: Action

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      GateWords(title: title, line: line)

      HStack(spacing: 8) {
        SubscribeButton()
        action
      }
      .buttonStyle(.outline)
      .controlSize(.small)
    }
    .accessibilityElement(children: .contain)
  }
}

extension SubscribeGate where Action == EmptyView {
  init(title: Text, line: Text? = nil) {
    self.init(title: title, line: line) {
      EmptyView()
    }
  }
}

/// What ran out as the title, and when it comes back as the one line under it.
struct LimitWords: Equatable {
  var title: LocalizedStringResource?
  var line: LocalizedStringResource?

  /// The words as one sentence, for a place that holds plain text: "{title}. {line}".
  var sentence: LocalizedStringResource? {
    guard let title, let line else {
      return title ?? line
    }

    return LocalizedStringResource(
      "\(title). \(line)", table: "Subscriptions",
      comment:
        "A notice that something the learner uses ran out, as one line: {title} says what ran out, such as \"You've used your uploads\", and {line} when more comes back, such as \"More on November 22, or subscribe to keep going.\""
    )
  }

  /// The sentence for VoiceOver or a place that holds a string.
  var said: String {
    sentence.map { String(localized: $0) } ?? ""
  }

  static func == (lhs: LimitWords, rhs: LimitWords) -> Bool {
    lhs.said == rhs.said
  }
}

/// Main's limit notices: the words, then the way on. A guest creates an account, a free learner
/// subscribes, and a subscriber or a short break has only the words.
struct LimitNotice: View {
  let limit: HelpLimit
  /// Read at the gate's clock, so words about a day or a short break's wait follow it while the
  /// notice is open.
  private let words: (HelpLimit, Date) -> LimitWords

  init(limit: HelpLimit, words: @escaping (Date) -> LimitWords) {
    self.limit = limit
    self.words = { _, now in words(now) }
  }

  init(limit: HelpLimit, words: LimitWords) {
    self.init(limit: limit) { _ in words }
  }

  init(limit: HelpLimit, kind: HelpLimit.Kind? = nil) {
    self.limit = limit
    self.words = { limit, now in limit.words(kind, now: now) }
  }

  var body: some View {
    LimitClock(limit: limit) { timed, now in
      notice(words(timed ?? limit, now), isOpen: limit.isOpen(at: now))
    }
  }

  /// Once the day has come, the screen's own action is the way on, so the notice offers nothing, in
  /// the room it had.
  private func notice(_ words: LimitWords, isOpen: Bool) -> some View {
    HeldSlot(gated: !isOpen) {
      VStack(alignment: .leading, spacing: 8) {
        GateWords(title: words.title.map(Text.init), line: words.line.map(Text.init))

        if !isOpen {
          LimitWayOn(limit: limit)
            .buttonStyle(.outline)
            .controlSize(.small)
        }
      }
    }
    .accessibilityElement(children: .contain)
  }
}

/// Main's way on from a limit, for any screen that shows one: a guest creates a free account, a
/// free learner subscribes, and a subscriber has none. The caller styles it and hides it once the
/// limit's day has come (`isOpen(at:)`).
struct LimitWayOn: View {
  @Environment(AppRouter.self) private var router

  let limit: HelpLimit

  var body: some View {
    if limit.needsAccount {
      Button {
        router.present(.signIn)
      } label: {
        Label {
          Text(
            "Create a free account", tableName: "Subscriptions",
            comment: "Opens sign-up for a guest who reached what they can try without an account")
        } icon: {
          Image(systemName: "person.badge.plus")
        }
      }
    } else if limit.offersSubscription {
      SubscribeButton()
    }
  }
}

extension HelpLimit {
  /// What ran out, which the gate's title names; without one it's the small help (speech, a
  /// writing check).
  enum Kind {
    case lessons
    case messages
    case explanations
    case quickExplanations
    case mindMaps
    case previews
    case goals
    case uploads
    case questions
    case callTime
  }

  /// Main's limit words: what ran out as the title, when more comes back as the line. A monthly
  /// cap's day comes from `availableAt`, read at `now` in the learner's own time zone.
  func words(_ kind: Kind? = nil, now: Date = .now, calendar: Calendar = .current) -> LimitWords {
    switch self {
    case .slowDown(let seconds, let until):
      LimitWords(
        line: Self.waitLine(
          seconds: until.map { Int($0.timeIntervalSince(now).rounded(.up)) } ?? seconds))
    case .signUpRequired:
      LimitWords(
        title: LocalizedStringResource(
          "This needs a free account", table: "Subscriptions",
          comment: "A guest tried something that needs a signed-up account"))
    case .limitReached(_, .guest), .usedUp(.guest, _):
      LimitWords(title: Self.guestTitle(kind))
    case .usedUp where kind == .lessons && isOpen(at: now):
      Self.freeLessonReady
    case .usedUp where kind == .callTime && isOpen(at: now):
      LimitWords(title: Self.callTimeBack, line: Self.tryAgainNow)
    // Once the day has come nothing ran out, so no title says it did.
    case .usedUp where isOpen(at: now):
      LimitWords(line: Self.tryAgainNow)
    case .usedUp(let tier, let availableAt):
      LimitWords(
        title: Self.usedUpTitle(kind),
        line: availableAt.flatMap {
          Self.moreOn(Self.openingDay($0, now: now, calendar: calendar), tier: tier)
        })
    case .limitReached(.total, _):
      LimitWords(title: Self.usedUpTitle(kind))
    case .limitReached(.day, let tier):
      LimitWords(title: Self.todayTitle(kind), line: Self.moreTomorrow(tier))
    }
  }

  /// `words` as one sentence, where a gate is one line.
  func sentence(_ kind: Kind? = nil, now: Date = .now) -> LocalizedStringResource {
    words(kind, now: now).sentence ?? Self.usedUpTitle(kind)
  }

  static let freeLessonReady = LimitWords(
    title: LocalizedStringResource("Your next free lesson is ready", table: "Subscriptions"))

  private static let callTimeBack = LocalizedStringResource(
    "Your call time is back", table: "Subscriptions",
    comment:
      "The title over \"You can try again now.\" once a call the learner's call time stopped can be made again."
  )

  private static let tryAgainNow = LocalizedStringResource(
    "You can try again now.", table: "Subscriptions",
    comment:
      "The line under the title of a notice that something the learner uses ran out, such as their messages to the study buddy or their free lessons: when more comes back."
  )

  /// Main's slow-down line: the wait left, in seconds under a minute and in minutes above, and
  /// once it's over that the learner can try again.
  static func waitLine(seconds: Int) -> LocalizedStringResource {
    if seconds <= 0 {
      return tryAgainNow
    }

    if seconds < 60 {
      return LocalizedStringResource(
        "Take a short break. You can try again in \(seconds) seconds.", table: "Subscriptions",
        comment:
          "The line of a notice that the learner sent too many requests in a short time, such as questions to their study buddy, and must wait before the next one. It counts down every second until they can try again."
      )
    }

    let minutes = (seconds + 59) / 60

    return LocalizedStringResource(
      "Take a short break. You can try again in \(minutes) minutes.", table: "Subscriptions",
      comment:
        "The line of a notice that the learner sent too many requests in a short time, such as questions to their study buddy, and must wait before the next one. It counts down every minute until they can try again."
    )
  }

  private static func usedUpTitle(_ kind: Kind?) -> LocalizedStringResource {
    switch kind {
    case .lessons:
      LocalizedStringResource("You've used your free lessons", table: "Subscriptions")
    case .messages:
      LocalizedStringResource("You've used your messages", table: "Subscriptions")
    case .explanations:
      LocalizedStringResource("You've used your explanations", table: "Subscriptions")
    case .quickExplanations:
      LocalizedStringResource("You've used your quick explanations", table: "Subscriptions")
    case .mindMaps:
      LocalizedStringResource("You've used your mind maps", table: "Subscriptions")
    case .previews:
      LocalizedStringResource(
        "You've used your early lessons", table: "Subscriptions",
        comment:
          "Early lessons are a topic's lessons got ready before the plan reaches it, from a topic far ahead; not the cap on new lessons."
      )
    case .goals:
      LocalizedStringResource("You've started all the new goals you can", table: "Subscriptions")
    case .uploads:
      LocalizedStringResource("You've used your uploads", table: "Subscriptions")
    case .questions:
      LocalizedStringResource("You've used your questions", table: "Subscriptions")
    case .callTime:
      LocalizedStringResource("You've used your call time", table: "Subscriptions")
    case nil:
      LocalizedStringResource("You've reached your limit", table: "Subscriptions")
    }
  }

  private static func todayTitle(_ kind: Kind?) -> LocalizedStringResource {
    switch kind {
    case .lessons:
      LocalizedStringResource(
        "No more new lessons today", table: "Subscriptions",
        comment: "The learner started all the new lessons they can today")
    case .messages:
      LocalizedStringResource(
        "No more messages today", table: "Subscriptions",
        comment: "The learner sent all the messages to their buddy they can today")
    case .explanations:
      LocalizedStringResource(
        "No more explanations today", table: "Subscriptions",
        comment: "The learner asked for all the answer explanations they can today")
    case .mindMaps:
      LocalizedStringResource(
        "No more new mind maps today", table: "Subscriptions",
        comment: "The learner made all the new mind maps they can today")
    case .previews:
      LocalizedStringResource(
        "No more early lessons today", table: "Subscriptions",
        comment:
          "Early lessons are a topic's lessons got ready before the plan reaches it, from a topic far ahead; not the cap on new lessons."
      )
    case .callTime:
      LocalizedStringResource(
        "No more calls today", table: "Subscriptions", comment: "The plan's call time is used")
    case .quickExplanations, .goals, .uploads, .questions, nil:
      LocalizedStringResource(
        "You've reached today's limit", table: "Subscriptions",
        comment: "The learner used today's AI checks, clips and similar")
    }
  }

  private static func guestTitle(_ kind: Kind?) -> LocalizedStringResource {
    switch kind {
    case .lessons:
      LocalizedStringResource(
        "No more lessons without an account", table: "Subscriptions",
        comment: "A guest took the lessons they can try without an account")
    case .mindMaps:
      LocalizedStringResource(
        "No more mind maps without an account", table: "Subscriptions",
        comment: "A guest made the mind maps they can try without an account")
    case .previews:
      LocalizedStringResource(
        "No more early lessons without an account", table: "Subscriptions",
        comment:
          "Early lessons are a topic's lessons got ready before the plan reaches it, from a topic far ahead; not the cap on new lessons."
      )
    case .callTime:
      LocalizedStringResource(
        "Calls need a free account", table: "Subscriptions", comment: "A guest can't call")
    default:
      LocalizedStringResource(
        "That's all you can try without an account", table: "Subscriptions",
        comment: "A guest used what they can try without an account")
    }
  }

  /// A day's cap comes back tomorrow; a subscriber has no subscription to offer.
  private static func moreTomorrow(_ tier: LearnerTier) -> LocalizedStringResource {
    tier == .plus
      ? LocalizedStringResource(
        "More tomorrow.", table: "Subscriptions",
        comment: "Under a limit a subscriber reached: it comes back tomorrow")
      : LocalizedStringResource(
        "More tomorrow, or subscribe to keep going.", table: "Subscriptions",
        comment: "Under a limit a free learner reached: it comes back tomorrow")
  }

  /// A monthly cap's line: the day its next use comes back, by the learner's clock.
  private static func moreOn(_ day: OpeningDay, tier: LearnerTier) -> LocalizedStringResource {
    let isPlus = tier == .plus

    switch day {
    case .open:
      return tryAgainNow
    case .today:
      return isPlus
        ? LocalizedStringResource(
          "More later today.", table: "Subscriptions",
          comment:
            "The line under the title of a notice that something the learner uses ran out, such as their messages to the study buddy or their free lessons: when more comes back."
        )
        : LocalizedStringResource(
          "More later today, or subscribe to keep going.", table: "Subscriptions",
          comment:
            "The line under the title of a notice that something the learner uses ran out, such as their messages to the study buddy or their free lessons: when more comes back."
        )
    case .tomorrow:
      return moreTomorrow(tier)
    case .on(let date):
      return isPlus
        ? LocalizedStringResource(
          "More on \(date).", table: "Subscriptions",
          comment:
            "The line under the title of a notice that something the learner uses ran out, such as their messages to the study buddy or their free lessons: the day more comes back. {date} is a day and its month, such as \"November 22\" in English."
        )
        : LocalizedStringResource(
          "More on \(date), or subscribe to keep going.", table: "Subscriptions",
          comment:
            "The line under the title of a notice that something the learner uses ran out, such as their messages to the study buddy or their free lessons: the day more comes back. {date} is a day and its month, such as \"November 22\" in English."
        )
    }
  }

  /// When the gate's words next change: the learner's next midnight or the opening, whichever is
  /// first. Nothing once the lesson has opened.
  static func nextWake(availableAt: Date, now: Date, calendar: Calendar = .current) -> Date? {
    guard availableAt > now else {
      return nil
    }

    let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now))
    return min(availableAt, midnight ?? availableAt)
  }

  /// Main's `toOpeningDay`: the day something opens, in the learner's own time zone, with no clock
  /// time, no count of days and no year, since a cap's day is never more than 30 days away.
  enum OpeningDay: Equatable {
    case open, today, tomorrow
    /// The day and its month in the learner's language, such as "November 22".
    case on(String)
  }

  static func openingDay(_ availableAt: Date, now: Date, calendar: Calendar) -> OpeningDay {
    guard availableAt > now else {
      return .open
    }

    let days =
      calendar.dateComponents(
        [.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: availableAt)
      ).day ?? 0

    switch days {
    case ...0: return .today
    case 1: return .tomorrow
    default:
      return .on(
        PlanDate.moment(availableAt, .sentence, year: .never, timeZone: calendar.timeZone))
    }
  }

  /// Main's `useMapLessonsWords`: a map writes its lessons first, so a free learner's map waits
  /// until all of them fit in the lessons left over the last 30 days, and one that needs more than
  /// that never fits. The learner may still have lessons left, so these never say they used them.
  func mapLessonsWords(now: Date = .now, calendar: Calendar = .current) -> LimitWords {
    switch self {
    case .usedUp(_, let availableAt):
      return Self.mapFitsWords(
        availableAt.map { Self.openingDay($0, now: now, calendar: calendar) })
    case .limitReached(_, .free):
      return LimitWords(
        title: LocalizedStringResource("This map needs a subscription", table: "Subscriptions"),
        line: LocalizedStringResource(
          "This chapter has more lessons than you get for free.", table: "Subscriptions",
          comment:
            "Under the title of a notice on a chapter's mind map: making the map needs every lesson of its chapter, and this chapter has more lessons than a free learner can start."
        ))
    case .limitReached, .slowDown, .signUpRequired:
      return words(.mindMaps, now: now, calendar: calendar)
    }
  }

  private static func mapFitsWords(_ day: OpeningDay?) -> LimitWords {
    let title = LocalizedStringResource(
      "Not enough free lessons for this map yet", table: "Subscriptions")

    switch day {
    case .open:
      return LimitWords(
        title: LocalizedStringResource("You can create this map now", table: "Subscriptions"))
    case nil:
      return LimitWords(title: title)
    case .today:
      return LimitWords(
        title: title,
        line: LocalizedStringResource(
          "You'll have enough later today, or subscribe to create it now.", table: "Subscriptions",
          comment:
            "Under the title of a notice on a chapter's mind map: making the map writes its lessons first, and the free learner doesn't have enough free lessons left for all of them yet."
        ))
    case .tomorrow:
      return LimitWords(
        title: title,
        line: LocalizedStringResource(
          "You'll have enough tomorrow, or subscribe to create it now.", table: "Subscriptions",
          comment:
            "Under the title of a notice on a chapter's mind map: making the map writes its lessons first, and the free learner doesn't have enough free lessons left for all of them yet."
        ))
    case .on(let date):
      return LimitWords(
        title: title,
        line: LocalizedStringResource(
          "You'll have enough on \(date), or subscribe to create it now.", table: "Subscriptions",
          comment:
            "Under the title of a notice on a chapter's mind map: making the map writes its lessons first, and the free learner doesn't have enough free lessons left for all of them yet. {date} is a day and its month, such as \"November 22\" in English."
        ))
    }
  }

}

/// Draws a limit at each whole second of a short break, so its wait counts down, and any other at
/// the opening clock. A short break nothing timed counts from when this first shows, and `content`
/// gets it with that end.
struct LimitClock<Content: View>: View {
  @State private var shownAt = Date.now

  let limit: HelpLimit?
  @ViewBuilder let content: (HelpLimit?, Date) -> Content

  var body: some View {
    let timed = limit?.started(at: shownAt)

    if let end = timed?.breakEnd, end > .now {
      TimelineView(.explicit(Self.seconds(until: end, from: .now))) { context in
        content(timed, context.date)
      }
    } else {
      OpeningClock(availableAt: timed?.availableAt) { now in
        content(timed, now)
      }
    }
  }

  /// Each whole second left before `end`, the first at or before `now`.
  static func seconds(until end: Date, from now: Date) -> [Date] {
    let left = Int(end.timeIntervalSince(now).rounded(.up))
    return (0...max(left, 0)).reversed().map { end.addingTimeInterval(-TimeInterval($0)) }
  }
}

/// Main's `useOpeningDay`: the time a monthly cap's opening is read at. It moves at the learner's
/// midnight (its day changes), when the instant passes and when the app comes back to the front, so
/// a gate left open never promises a day that has gone.
struct OpeningClock<Content: View>: View {
  @Environment(\.scenePhase) private var scenePhase
  @State private var alarm = OpeningAlarm()

  let availableAt: Date?
  @ViewBuilder let content: (Date) -> Content

  var body: some View {
    content(alarm.now(waking: availableAt))
  }
}

/// The clock's wake, kept apart from what it draws: a bar that takes its buttons apart draws nothing
/// for a gate that hides its action, and a timer on that content would never start.
@MainActor @Observable
private final class OpeningAlarm {
  private var rang = 0
  @ObservationIgnored private var wake: Date?
  @ObservationIgnored private var ringing: Task<Void, Never>?

  /// The time to read the gate at, ringing again at the learner's next midnight or the opening.
  func now(waking availableAt: Date?) -> Date {
    _ = rang
    let now = Date.now
    let next = availableAt.flatMap { HelpLimit.nextWake(availableAt: $0, now: now) }

    if next != wake {
      wake = next
      ringing?.cancel()
      ringing = next.map { next in
        Task { [weak self] in
          try? await Task.sleep(for: .seconds(next.timeIntervalSinceNow), tolerance: .seconds(1))

          if !Task.isCancelled, let self {
            wake = nil
            rang += 1
          }
        }
      }
    }

    return now
  }

  isolated deinit {
    ringing?.cancel()
  }
}
