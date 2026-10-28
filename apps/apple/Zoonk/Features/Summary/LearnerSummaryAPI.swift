import Foundation

/// What the app's frame shows about the signed-in learner, read in one request. Features add the
/// fields they draw (goals, buddy, today, missions, places) as they need them.
struct LearnerSummary: Equatable, Sendable {
  let activeGoalID: String?
  let identity: LearnerIdentity
  /// When the summary changes without a write (the next midnight, the subscription's next change
  /// or the session's end), so it's read again then.
  let nextChangeAt: Date
  let readAt: Date
  let tier: LearnerTier
  let timeZone: String?
}

struct LearnerIdentity: Equatable, Sendable {
  let isAnonymous: Bool
  let signedInAt: Date
  let userID: String
}

enum LearnerTier: String, Equatable, Sendable {
  case free
  case guest
  case plus
}

protocol LearnerSummaryAPIClient {
  func getSummary(token: String) async throws -> LearnerSummary
}

struct LearnerSummaryAPI: LearnerSummaryAPIClient {
  let clients: APIClientFactory

  func getSummary(token: String) async throws -> LearnerSummary {
    try await clients.perform(token: token) { client in
      switch try await client.getCurrentUserSummary() {
      case .ok(let response):
        return makeLearnerSummary(try response.body.json.summary)
      case .unauthorized:
        throw APIError.unauthorized
      case .internalServerError, .undocumented:
        throw APIError.unavailable
      }
    }
  }
}

private func makeLearnerSummary(_ summary: Components.Schemas.LearnerSummary) -> LearnerSummary {
  LearnerSummary(
    activeGoalID: summary.activeGoalId,
    identity: LearnerIdentity(
      isAnonymous: summary.identity.isAnonymous,
      signedInAt: dateFromEpochMilliseconds(summary.identity.signedInAt),
      userID: summary.identity.userId),
    nextChangeAt: dateFromEpochMilliseconds(summary.nextChangeAt),
    readAt: dateFromEpochMilliseconds(summary.readAt),
    tier: LearnerTier(rawValue: summary.tier.rawValue) ?? .free,
    timeZone: summary.timeZone)
}

/// The API sends instants as milliseconds since the epoch.
func dateFromEpochMilliseconds(_ milliseconds: Int) -> Date {
  Date(timeIntervalSince1970: Double(milliseconds) / 1_000)
}
