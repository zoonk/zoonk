import SwiftUI

/// Main's `GateWords`: what stopped, and at most one line under it.
struct GateWords: View {
  var title: Text?
  var line: Text?

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      if let title {
        title
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))
      }

      if let line {
        line
          .typeStyle(.body)
          .foregroundStyle(.mutedForeground)
      }
    }
    .fixedSize(horizontal: false, vertical: true)
    .frame(maxWidth: .infinity, alignment: .leading)
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
        "A limit's words where they're one sentence, such as under a button or as the buddy's answer: what ran out, then when more comes back"
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
  @Environment(AppRouter.self) private var router

  let limit: HelpLimit
  /// Read at the gate's clock, so words about a day follow it while the notice is open.
  let words: (Date) -> LimitWords

  init(limit: HelpLimit, words: @escaping (Date) -> LimitWords) {
    self.limit = limit
    self.words = words
  }

  init(limit: HelpLimit, words: LimitWords) {
    self.init(limit: limit) { _ in words }
  }

  init(limit: HelpLimit, kind: HelpLimit.Kind? = nil) {
    self.init(limit: limit) { now in limit.words(kind, now: now) }
  }

  var body: some View {
    OpeningClock(availableAt: limit.availableAt) { now in
      notice(words(now))
    }
  }

  private func notice(_ words: LimitWords) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      GateWords(title: words.title.map(Text.init), line: words.line.map(Text.init))

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
        .buttonStyle(.outline)
        .controlSize(.small)
      } else if limit.offersSubscription {
        SubscribeButton()
          .buttonStyle(.outline)
          .controlSize(.small)
      }
    }
    .accessibilityElement(children: .contain)
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
    case mockExams
  }

  /// Main's limit words: what ran out as the title, when more comes back as the line. A monthly
  /// cap's day comes from `availableAt`, read at `now` in the learner's own time zone.
  func words(_ kind: Kind? = nil, now: Date = .now, calendar: Calendar = .current) -> LimitWords {
    switch self {
    case .slowDown:
      LimitWords(
        line: LocalizedStringResource(
          "Take a short break, then try again.", table: "Subscriptions",
          comment: "Fair use asks the learner to wait a moment before trying again"))
    case .signUpRequired:
      LimitWords(
        title: LocalizedStringResource(
          "This needs a free account", table: "Subscriptions",
          comment: "A guest tried something that needs a signed-up account"))
    case .limitReached(_, .guest), .usedUp(.guest, _):
      LimitWords(title: Self.guestTitle(kind))
    case .usedUp where kind == .lessons && isOpen(at: now):
      Self.freeLessonReady
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

  private static func usedUpTitle(_ kind: Kind?) -> LocalizedStringResource {
    switch kind {
    case .lessons:
      LocalizedStringResource("You've used your free lessons", table: "Subscriptions")
    case .messages:
      LocalizedStringResource(
        "You've used your messages", table: "Subscriptions",
        comment:
          "In place of the buddy's message box: the learner sent all the messages their plan allows"
      )
    case .explanations:
      LocalizedStringResource(
        "You've used your explanations", table: "Subscriptions",
        comment:
          "In place of an answer's explanation: the learner asked for all the explanations their plan allows"
      )
    case .quickExplanations:
      LocalizedStringResource(
        "You've used your quick explanations", table: "Subscriptions",
        comment:
          "Before a goal starts: the learner asked for all the quick explanations of a topic their plan allows"
      )
    case .mindMaps:
      LocalizedStringResource(
        "You've used your mind maps", table: "Subscriptions",
        comment:
          "In place of making a chapter's mind map: the learner made all the mind maps their plan allows"
      )
    case .previews:
      LocalizedStringResource(
        "You've used your previews", table: "Subscriptions",
        comment:
          "In place of a topic's lessons ahead of time: the learner saw all the previews their plan allows"
      )
    case .goals:
      LocalizedStringResource(
        "You've started all the new goals you can", table: "Subscriptions",
        comment: "Where a new goal starts: the learner started all the new goals their plan allows")
    case .uploads:
      LocalizedStringResource(
        "You've used your uploads", table: "Subscriptions",
        comment:
          "Under adding material to a goal: the learner added all the material their plan allows")
    case .questions:
      LocalizedStringResource(
        "You've used your questions", table: "Subscriptions",
        comment:
          "Under asking about the learner's material: they asked all the questions their plan allows"
      )
    case .callTime:
      LocalizedStringResource(
        "You've used your call time", table: "Subscriptions",
        comment:
          "Where a speaking call starts: the learner used all the call time their plan allows")
    case .mockExams:
      LocalizedStringResource(
        "You've used your mock exams", table: "Subscriptions",
        comment:
          "In place of starting a mock exam: the learner took all the mock exams their plan allows")
    case nil:
      LocalizedStringResource(
        "You've reached your limit", table: "Subscriptions",
        comment:
          "The learner used all the small AI help their plan allows: checks, clips and similar")
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
        "No more previews today", table: "Subscriptions",
        comment: "The learner saw all the topics ahead of time they can today")
    case .callTime:
      LocalizedStringResource(
        "No more calls today", table: "Subscriptions", comment: "The plan's call time is used")
    case .quickExplanations, .goals, .uploads, .questions, .mockExams, nil:
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
        "No more previews without an account", table: "Subscriptions",
        comment: "A guest saw the topic ahead of time they can without an account")
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
      return LocalizedStringResource(
        "You can try again now.", table: "Subscriptions",
        comment:
          "Under a monthly limit the learner reached: the day more comes back has come while the screen was open"
      )
    case .today:
      return isPlus
        ? LocalizedStringResource(
          "More later today.", table: "Subscriptions",
          comment: "Under a monthly limit a subscriber reached: more comes back later today")
        : LocalizedStringResource(
          "More later today, or subscribe to keep going.", table: "Subscriptions",
          comment: "Under a monthly limit a free learner reached: more comes back later today")
    case .tomorrow:
      return moreTomorrow(tier)
    case .on(let date):
      return isPlus
        ? LocalizedStringResource(
          "More on \(date).", table: "Subscriptions",
          comment:
            "Under a monthly limit a subscriber reached: the day more comes back. {date} is a day and its month, such as \"November 22\" in English."
        )
        : LocalizedStringResource(
          "More on \(date), or subscribe to keep going.", table: "Subscriptions",
          comment:
            "Under a monthly limit a free learner reached: the day more comes back. {date} is a day and its month, such as \"November 22\" in English."
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
  /// time and no count of days.
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
        PlanDate.momentDay(
          availableAt,
          style: Date.FormatStyle(
            locale: calendar.locale ?? .current, calendar: calendar, timeZone: calendar.timeZone
          ).month(.wide).day(), now: now, calendar: calendar))
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
          "It writes more lessons than you get for free.", table: "Subscriptions",
          comment:
            "Under the title of a notice on a chapter's mind map: making the map writes its lessons first, and this one has more lessons than a free learner can start."
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
        title: LocalizedStringResource("You can make this map now", table: "Subscriptions"))
    case nil:
      return LimitWords(title: title)
    case .today:
      return LimitWords(
        title: title,
        line: LocalizedStringResource(
          "You'll have enough later today, or subscribe to make it now.", table: "Subscriptions",
          comment:
            "Under the title of a notice on a chapter's mind map: making the map writes its lessons first, and the free learner doesn't have enough free lessons left for all of them yet."
        ))
    case .tomorrow:
      return LimitWords(
        title: title,
        line: LocalizedStringResource(
          "You'll have enough tomorrow, or subscribe to make it now.", table: "Subscriptions",
          comment:
            "Under the title of a notice on a chapter's mind map: making the map writes its lessons first, and the free learner doesn't have enough free lessons left for all of them yet."
        ))
    case .on(let date):
      return LimitWords(
        title: title,
        line: LocalizedStringResource(
          "You'll have enough on \(date), or subscribe to make it now.", table: "Subscriptions",
          comment:
            "Under the title of a notice on a chapter's mind map: making the map writes its lessons first, and the free learner doesn't have enough free lessons left for all of them yet. {date} is a day and its month, such as \"November 22\" in English."
        ))
    }
  }

}

/// Main's `useOpeningDay`: the time a monthly cap's opening is read at. It moves at the learner's
/// midnight (its day changes), when the instant passes and when the app comes back to the front, so
/// a gate left open never promises a day that has gone.
struct OpeningClock<Content: View>: View {
  @Environment(\.scenePhase) private var scenePhase
  @State private var now = Date.now

  let availableAt: Date?
  @ViewBuilder let content: (Date) -> Content

  var body: some View {
    content(now)
      .task(id: availableAt) {
        guard let availableAt else {
          return
        }

        while !Task.isCancelled {
          now = .now

          guard let wake = HelpLimit.nextWake(availableAt: availableAt, now: now) else {
            return
          }

          try? await Task.sleep(for: .seconds(wake.timeIntervalSince(now)))
        }
      }
      .onChange(of: scenePhase) { _, phase in
        if phase == .active {
          now = .now
        }
      }
  }

}
