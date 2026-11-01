import Foundation
// For `persistOptOut`: the summary decides consent, so PostHog mustn't restore its own at launch.
@_spi(PostHogInternal) import PostHog
import SwiftUI
import Synchronization

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
private func orNull<Value>(_ value: Value?) -> Any {
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
      UsageDataGate.share(as: [])

      // A visitor's events wait for the session they lead to; a learner's end with their session.
      if consent == .declined || previous != .undecided(nil) {
        waiting = []
      }

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

    UsageDataGate.share(as: [learner.userID, postHog.getDistinctId(), postHog.getAnonymousId()])

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
    // Plain JSON, so the gate can read whose events a batch carries.
    config.compression = .none
    config.urlSessionConfiguration = UsageDataGate.sessionConfiguration
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

/// Opted out, PostHog still uploads the events it queued before, such as those from offline, and
/// asks for flags on reset: it checks the choice only when an event is captured. This answers what
/// may leave. Only event batches do, as nothing else of PostHog's is used, and only with the sharing
/// learner's events; a refused batch gets an answer PostHog doesn't retry, so it leaves the queue.
final class UsageDataGate: URLProtocol, @unchecked Sendable {
  /// The sharing learner's id and the random one their events before identify went under; empty
  /// while nobody shares.
  private static let sendingAs = Mutex<Set<String>>([])
  private var forwarding: URLSessionDataTask?

  static func share(as ids: Set<String>) {
    sendingAs.withLock { $0 = ids }
  }

  static var sessionConfiguration: URLSessionConfiguration {
    let configuration = URLSessionConfiguration.default
    configuration.protocolClasses = [Self.self] + (configuration.protocolClasses ?? [])
    return configuration
  }

  static func mayLeave(_ request: URLRequest, body: Data, as ids: Set<String>) -> Bool {
    guard !ids.isEmpty, request.url?.path().hasSuffix("/batch") == true,
      let sent = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
      let batch = sent["batch"] as? [[String: Any]]
    else {
      return false
    }

    return batch.allSatisfy { ($0["distinct_id"] as? String).map(ids.contains) == true }
  }

  override class func canInit(with request: URLRequest) -> Bool {
    true
  }

  override class func canonicalRequest(for request: URLRequest) -> URLRequest {
    request
  }

  override func startLoading() {
    // An upload's body reaches a protocol only as a stream.
    let body = request.httpBodyStream.map(Self.read) ?? request.httpBody ?? Data()

    guard Self.mayLeave(request, body: body, as: Self.sendingAs.withLock { $0 }) else {
      return refuse()
    }

    var forwarded = request
    forwarded.httpBody = body

    forwarding = URLSession.shared.dataTask(with: forwarded) { [self] data, response, error in
      if let response {
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
      }

      if let data {
        client?.urlProtocol(self, didLoad: data)
      }

      if let error {
        client?.urlProtocol(self, didFailWithError: error)
      } else {
        client?.urlProtocolDidFinishLoading(self)
      }
    }

    forwarding?.resume()
  }

  override func stopLoading() {
    forwarding?.cancel()
  }

  private func refuse() {
    guard let url = request.url,
      let refusal = HTTPURLResponse(url: url, statusCode: 403, httpVersion: nil, headerFields: nil)
    else {
      client?.urlProtocol(self, didFailWithError: URLError(.badURL))
      return
    }

    client?.urlProtocol(self, didReceive: refusal, cacheStoragePolicy: .notAllowed)
    client?.urlProtocolDidFinishLoading(self)
  }

  private static func read(_ stream: InputStream) -> Data {
    var data = Data()
    var buffer = [UInt8](repeating: 0, count: 16_384)
    stream.open()
    defer { stream.close() }

    while stream.hasBytesAvailable {
      let count = stream.read(&buffer, maxLength: buffer.count)

      guard count > 0 else {
        break
      }

      data.append(buffer, count: count)
    }

    return data
  }
}
