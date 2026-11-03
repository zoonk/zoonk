import Foundation
// For `persistOptOut`: the summary decides consent, so PostHog mustn't restore its own at launch.
@_spi(PostHogInternal) import PostHog
import SwiftUI

/// The learner PostHog counts, with what main sends for them: the person properties it identifies
/// them with and the properties every event carries.
struct AnalyticsLearner: Equatable {
  let userID: String
  let analytics: LearnerAnalytics
  let isGuest: Bool
  let locale: String

  var personProperties: [String: Any] {
    [
      "analyticsDisabled": analytics.disabled,
      "plan": analytics.plan,
      "userId": userID,
      "username": orNull(analytics.username),
    ]
  }

  var sharedProperties: [String: Any] {
    [
      "goal_kind": orNull(analytics.goalKind?.rawValue),
      "is_guest": isGuest,
      "locale": locale,
      "plan_phase": orNull(analytics.planPhase),
      "platform": "ios",
    ]
  }
}

/// Main sends a missing value as null, which a Swift optional in `[String: Any]` can't encode.
func orNull<Value>(_ value: Value?) -> Any {
  if let value { value } else { NSNull() }
}

enum AnalyticsConsent: Equatable {
  /// No learner's summary has said yet, so events wait for it, as main's wait for its decision.
  case undecided(AuthenticatedSession?)
  case declined
  case granted(AnalyticsLearner)

  init(session: AuthenticatedSession?, summary: LearnerSummary?, locale: String) {
    guard let summary else {
      self = .undecided(session)
      return
    }

    guard summary.analytics.usageDataSharing == true else {
      self = .declined
      return
    }

    self = .granted(
      AnalyticsLearner(
        userID: summary.identity.userID, analytics: summary.analytics,
        isGuest: summary.identity.isAnonymous, locale: locale))
  }
}

/// PostHog counts only learners who share usage data. It's set up the first time one does, so
/// nothing reaches PostHog before, and only Release builds name a project.
@MainActor
enum UsageAnalytics {
  private static let configuration = makeConfiguration()
  private static var postHog: PostHogSDK?
  private static var consent = AnalyticsConsent.undecided(nil)
  private static var waiting: [(event: AnalyticsEvent, at: Date)] = []

  static func track(_ event: AnalyticsEvent) {
    switch consent {
    case .undecided:
      waiting.append((event, .now))
    case .declined:
      break
    case .granted:
      postHog?.capture(event.name, properties: event.properties)
    }
  }

  static func follow(_ consent: AnalyticsConsent) {
    guard consent != self.consent else {
      return
    }

    let previous = self.consent
    self.consent = consent

    guard case .granted(let learner) = consent else {
      // A visitor's events wait for the session they lead to; a learner's end with their session.
      if consent == .declined || previous != .undecided(nil) {
        waiting = []
      }

      // By design, PostHog may still upload what it queued while the learner shared, and ask for
      // flags, as posthog-js does on the web: https://github.com/PostHog/posthog-ios/issues/1003
      postHog?.optOut()

      // The learner who shared signed out, or another learner's summary is on its way.
      if case .granted = previous, case .undecided = consent {
        postHog?.reset()
      }

      return
    }

    defer { waiting = [] }

    guard let postHog = postHog ?? start() else {
      return
    }

    // identify() keeps a learner already identified, so another learner needs a new identity.
    if postHog.getDistinctId() != learner.userID {
      postHog.reset()
    }

    postHog.register(learner.sharedProperties)
    postHog.optIn()
    postHog.identify(learner.userID, userProperties: learner.personProperties)

    for (event, at) in waiting {
      postHog.capture(event.name, properties: event.properties, timestamp: at)
    }
  }

  private static func start() -> PostHogSDK? {
    guard let configuration else {
      return nil
    }

    PostHogSDK.shared.setup(configuration)
    postHog = PostHogSDK.shared
    return postHog
  }

  private static func makeConfiguration() -> PostHogConfig? {
    guard
      let projectToken = Bundle.main.object(forInfoDictionaryKey: "ZoonkPostHogProjectToken")
        as? String,
      let host = Bundle.main.object(forInfoDictionaryKey: "ZoonkPostHogHost") as? String
    else {
      return nil
    }

    let config = PostHogConfig(projectToken: projectToken, host: host)
    // Every launch registers the learner's properties before opting in sends the install event.
    config.optOut = true
    config.persistOptOut = false
    config.personProfiles = .identifiedOnly
    config.captureApplicationLifecycleEvents = true
    // SwiftUI's hosting controllers would name every screen alike.
    config.captureScreenViews = false
    config.captureElementInteractions = false
    config.captureSwiftUIElementInteractions = false
    config.rageClickConfig.enabled = false
    config.sessionReplay = false
    config.surveys = false
    config.capturePushNotificationSubscriptions = false
    config.capturePushNotificationOpened = false
    config.preloadFeatureFlags = false
    config.sendFeatureFlagEvent = false
    return config
  }
}

extension View {
  /// Lets PostHog follow the learner the summary names and their usage data choice.
  func usageAnalytics() -> some View {
    modifier(UsageAnalyticsConsent())
  }
}

private struct UsageAnalyticsConsent: ViewModifier {
  @Environment(LearnerSummaryStore.self) private var learnerSummary
  @Environment(SessionStore.self) private var session

  func body(content: Content) -> some View {
    content.onChange(of: consent, initial: true) { _, consent in
      UsageAnalytics.follow(consent)
    }
  }

  private var consent: AnalyticsConsent {
    AnalyticsConsent(
      session: session.authenticatedSession, summary: learnerSummary.summary.value,
      locale: currentCourseCatalogLanguage())
  }
}
