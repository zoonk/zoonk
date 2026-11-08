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

  /// Main's `Onboarding Progressed` stages a client sees; the server sends the rest.
  enum OnboardingStage: Equatable {
    /// The goal's text was sent and the reply named its draft.
    case attemptLinked(attemptID: String, onboardingID: String)
    /// `question` is the core step, visible on screen.
    case questionShown(goalID: String, onboardingID: String?, question: String)
    /// The first time this visit heard the goal's run report its deck.
    case deckReceived(goalID: String, onboardingID: String?, deckID: String)
    case firstSceneVisible(goalID: String, lessonID: String)
    case firstAnswer(goalID: String, lessonID: String)
  }

  /// Main's `Generation Waited`: one stretch of a wait while it was on screen.
  struct WaitSegment: Equatable {
    /// `curriculum` for onboarding's waits, `lesson` for a lesson's.
    let contentKind: String
    let surface: String
    let startedAt: Date
    let endedAt: Date
    var goalID: String?
    /// Before the goal exists, the typed goal's attempt or its draft.
    var attemptID: String?
    var onboardingID: String?
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
  case generationWaited(WaitSegment)
  case goalTyped(hasAttachment: Bool, attemptID: String, submittedAt: Date)
  case homeViewed
  case hookAnswered(lessonID: String)
  case insightShown(Insight)
  case logbookViewed
  case onboardingProgressed(OnboardingStage, at: Date)
  case planLinkOpened(planID: String)
  case publicPageViewed(contentID: String, page: PublicPage)
  case subscriptionCheckoutStarted(BillingPeriod)
  case subscriptionGateShown
  case todayViewed
  /// `position` counts from 1, the deck's first card.
  case warmUpAnswered(surface: WarmUpSurface, cardID: String, position: Int, correct: Bool)
  case warmUpShown(surface: WarmUpSurface, cardCount: Int, deckID: String, goalID: String?, at: Date)

  var name: String {
    switch self {
    case .activityAbandoned: "Activity Abandoned"
    case .activityUsed: "Activity Used"
    case .callEnded: "Call Ended"
    case .ceremonyShown: "Ceremony Shown"
    case .generationWaited: "Generation Waited"
    case .goalTyped: "Goal Typed"
    case .homeViewed: "Home Viewed"
    case .hookAnswered: "Hook Answered"
    case .insightShown: "Insight Shown"
    case .logbookViewed: "Logbook Viewed"
    case .onboardingProgressed: "Onboarding Progressed"
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
    case .generationWaited(let wait):
      [
        "attempt_id": orNull(wait.attemptID), "content_kind": wait.contentKind,
        "ended_at": epochMilliseconds(wait.endedAt), "goal_id": orNull(wait.goalID),
        "milliseconds": epochMilliseconds(wait.endedAt) - epochMilliseconds(wait.startedAt),
        "onboarding_id": orNull(wait.onboardingID),
        "started_at": epochMilliseconds(wait.startedAt), "surface": wait.surface,
      ]
    case .goalTyped(let hasAttachment, let attemptID, let submittedAt):
      [
        "attempt_id": attemptID, "has_attachment": hasAttachment,
        "submitted_at": epochMilliseconds(submittedAt),
      ]
    case .onboardingProgressed(let stage, let at):
      stage.properties.merging(["at": epochMilliseconds(at)]) { first, _ in first }
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
    case .warmUpShown(let surface, let cardCount, let deckID, let goalID, let at):
      [
        "at": epochMilliseconds(at), "card_count": cardCount, "deck_id": deckID,
        "goal_id": orNull(goalID), "surface": surface.rawValue,
      ]
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
    let stepKind =
      state.phase == .map ? "map" : stepID.flatMap { state.steps[$0]?.kind.rawValue } ?? "unknown"

    return .activityAbandoned(
      lessonID: state.lessonId, screen: state.position + 1, stepKind: stepKind,
      wrongInARow: wrongInARow(state))
  }

  /// Wrong verdicts since the last right one, counting each screen seen by its latest verdict that
  /// counts.
  private static func wrongInARow(_ state: LessonPlayerState) -> Int {
    var latestFirst: [String] = []

    for stepID in state.queue.prefix(state.position + 1).reversed()
    where !latestFirst.contains(stepID) {
      latestFirst.append(stepID)
    }

    let verdicts = latestFirst.compactMap(state.countedVerdict)

    return verdicts.firstIndex(of: true) ?? verdicts.count
  }
}

extension AnalyticsEvent.OnboardingStage {
  fileprivate var properties: [String: Any] {
    switch self {
    case .attemptLinked(let attemptID, let onboardingID):
      [
        "attempt_id": attemptID, "goal_id": NSNull(), "onboarding_id": onboardingID,
        "stage": "attempt_linked",
      ]
    case .questionShown(let goalID, let onboardingID, let question):
      [
        "goal_id": goalID, "onboarding_id": orNull(onboardingID), "question": question,
        "stage": "question_shown",
      ]
    case .deckReceived(let goalID, let onboardingID, let deckID):
      [
        "deck_id": deckID, "goal_id": goalID, "onboarding_id": orNull(onboardingID),
        "stage": "deck_received",
      ]
    case .firstSceneVisible(let goalID, let lessonID):
      ["goal_id": goalID, "lesson_id": lessonID, "stage": "first_scene_visible"]
    case .firstAnswer(let goalID, let lessonID):
      ["goal_id": goalID, "lesson_id": lessonID, "stage": "first_answer"]
    }
  }
}

/// The epoch milliseconds main's events carry their times in.
private func epochMilliseconds(_ date: Date) -> Int {
  Int((date.timeIntervalSince1970 * 1000).rounded())
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
