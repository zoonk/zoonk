import Foundation

/// The events main sends from the browser (`packages/core/src/analytics/events.ts`) that the app
/// has too, with the same names and properties. The server sends the outcomes of every write.
enum AnalyticsEvent: Equatable {
  enum BillingPeriod: String {
    case monthly, yearly
  }

  enum Ceremony: String {
    case belt
    case buddyStage = "buddy_stage"
    case glasses
  }

  enum Insight: String {
    case planChange = "plan_change"
    case schedule
    case tip
  }

  enum PublicPage: String {
    case chapter, course, lesson
  }

  enum WarmUpSurface: String {
    case planWait, placementWait, lessonWait
  }

  /// A reply gap runs from the learner's microphone going quiet to the next character transcript
  /// arriving: a proxy for the wait the learner heard.
  struct CallEnded: Equatable {
    let conversationKind: LanguageConversation.KindPayload
    let delegations: Int
    let durationSeconds: Int
    let learnerTurns: Int
    let reason: LiveCall.EndReason
    let replyGapMaxMs: Int?
    let replyGapMedianMs: Int?
    let slowReplies: Int
    let talkSeconds: Int
    let unansweredTurns: Int
  }

  case activityAbandoned(lessonID: String, screen: Int, stepKind: String, wrongInARow: Int)
  case activityUsed(lessonID: String, template: String)
  case callEnded(CallEnded)
  case ceremonyShown(Ceremony)
  case goalTyped(hasAttachment: Bool)
  case homeViewed
  case hookAnswered(lessonID: String)
  case insightShown(Insight)
  case logbookViewed
  case planLinkOpened(planID: String)
  case publicPageViewed(contentID: String, page: PublicPage)
  case subscriptionCheckoutStarted(BillingPeriod)
  case subscriptionGateShown
  case todayViewed
  /// `position` counts from 1, the deck's first card.
  case warmUpAnswered(surface: WarmUpSurface, cardID: String, position: Int, correct: Bool)
  case warmUpShown(surface: WarmUpSurface, cardCount: Int)

  var name: String {
    switch self {
    case .activityAbandoned: "Activity Abandoned"
    case .activityUsed: "Activity Used"
    case .callEnded: "Call Ended"
    case .ceremonyShown: "Ceremony Shown"
    case .goalTyped: "Goal Typed"
    case .homeViewed: "Home Viewed"
    case .hookAnswered: "Hook Answered"
    case .insightShown: "Insight Shown"
    case .logbookViewed: "Logbook Viewed"
    case .planLinkOpened: "Plan Link Opened"
    case .publicPageViewed: "Public Page Viewed"
    case .subscriptionCheckoutStarted: "Subscription Checkout Started"
    case .subscriptionGateShown: "Subscription Gate Shown"
    case .todayViewed: "Today Viewed"
    case .warmUpAnswered: "Warm-Up Answered"
    case .warmUpShown: "Warm-Up Shown"
    }
  }

  var properties: [String: Any] {
    switch self {
    case .activityAbandoned(let lessonID, let screen, let stepKind, let wrongInARow):
      [
        "lesson_id": lessonID, "screen": screen, "step_kind": stepKind,
        "wrong_in_a_row": wrongInARow,
      ]
    case .activityUsed(let lessonID, let template):
      ["lesson_id": lessonID, "template": template]
    case .callEnded(let call):
      [
        "conversation_kind": call.conversationKind.analyticsName, "delegations": call.delegations,
        "duration_seconds": call.durationSeconds, "learner_turns": call.learnerTurns,
        "reason": call.reason.rawValue, "reply_gap_max_ms": orNull(call.replyGapMaxMs),
        "reply_gap_median_ms": orNull(call.replyGapMedianMs), "slow_replies": call.slowReplies,
        "talk_seconds": call.talkSeconds, "unanswered_turns": call.unansweredTurns,
      ]
    case .ceremonyShown(let ceremony):
      ["ceremony": ceremony.rawValue]
    case .goalTyped(let hasAttachment):
      ["has_attachment": hasAttachment]
    case .hookAnswered(let lessonID):
      ["lesson_id": lessonID]
    case .insightShown(let insight):
      ["insight": insight.rawValue]
    case .planLinkOpened(let planID):
      ["plan_id": planID]
    case .publicPageViewed(let contentID, let page):
      ["content_id": contentID, "page": page.rawValue]
    case .subscriptionCheckoutStarted(let billingPeriod):
      ["billingPeriod": billingPeriod.rawValue, "plan": "plus"]
    case .warmUpAnswered(let surface, let cardID, let position, let correct):
      ["card_id": cardID, "correct": correct, "position": position, "surface": surface.rawValue]
    case .warmUpShown(let surface, let cardCount):
      ["card_count": cardCount, "surface": surface.rawValue]
    case .homeViewed, .logbookViewed, .subscriptionGateShown, .todayViewed:
      [:]
    }
  }

  /// A started lesson left before its end, on the screen the learner was on, as main counts it.
  static func abandonment(of state: LessonPlayerState) -> AnalyticsEvent? {
    guard state.runId != nil, state.phase != .completed else {
      return nil
    }

    let stepID = state.queue.indices.contains(state.position) ? state.queue[state.position] : nil

    return .activityAbandoned(
      lessonID: state.lessonId, screen: state.position + 1,
      stepKind: stepID.flatMap { state.steps[$0]?.kind.rawValue } ?? "unknown",
      wrongInARow: wrongInARow(state))
  }

  /// Wrong verdicts since the last right one, counting each screen seen by its latest verdict.
  private static func wrongInARow(_ state: LessonPlayerState) -> Int {
    var latestFirst: [String] = []

    for stepID in state.queue.prefix(state.position + 1).reversed()
    where !latestFirst.contains(stepID) {
      latestFirst.append(stepID)
    }

    let verdicts = latestFirst.compactMap { stepID in
      state.results[stepID].flatMap { $0.checked ? $0.isCorrect : nil }
    }

    return verdicts.firstIndex(of: true) ?? verdicts.count
  }
}

extension AnalyticsEvent.BillingPeriod {
  init(productID: String) {
    self = productID == AppStoreSubscriptionProduct.plusYearly ? .yearly : .monthly
  }
}

extension AnalyticsEvent.Ceremony {
  /// Badges have no ceremony event.
  init?(milestoneKind: String) {
    switch milestoneKind {
    case "belt": self = .belt
    case "buddyStage": self = .buddyStage
    case "glasses": self = .glasses
    default: return nil
    }
  }
}

extension AnalyticsEvent.Insight {
  init(_ insight: MemoryInsight) {
    switch insight.kind {
    case .planChange: self = .planChange
    case .scheduleIdea: self = .schedule
    case .tip: self = .tip
    }
  }
}

extension LanguageConversation.KindPayload {
  /// Core's `ConversationKind` in analytics.
  fileprivate var analyticsName: String {
    switch self {
    case .practice: "practice"
    case .checkpoint: "checkpoint"
    case .speakingMock: "speaking_mock"
    case .examSpeaking: "exam_speaking"
    }
  }
}
