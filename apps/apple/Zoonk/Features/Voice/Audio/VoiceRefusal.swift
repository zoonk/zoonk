import Foundation
import OpenAPIRuntime

/// Mirrors main's `HelpLimit`.
enum HelpLimit: Equatable, Sendable {
  enum Period: String, Sendable {
    case day
    case month
    case total
  }

  case slowDown(retryAfterSeconds: Int)
  case limitReached(period: Period, tier: LearnerTier)
  /// A free learner's lessons of the last 30 days are used; `opensAt` is when the next one opens.
  case freeLessonsUsed(opensAt: Date?)
  case signUpRequired

  /// A reached limit as the server names it: a free learner's last 30 days come with the instant
  /// the next lesson opens, every other limit with its period.
  static func reached(period: String?, tier: LearnerTier, opensAt: Date?) -> HelpLimit {
    period == "rolling30Days"
      ? .freeLessonsUsed(opensAt: opensAt)
      : .limitReached(period: period.flatMap(Period.init) ?? .day, tier: tier)
  }

  var needsAccount: Bool {
    switch self {
    case .signUpRequired:
      true
    case .limitReached(_, let tier):
      tier == .guest
    case .slowDown, .freeLessonsUsed:
      false
    }
  }

  var offersSubscription: Bool {
    switch self {
    case .limitReached(_, .free), .freeLessonsUsed:
      true
    case .limitReached, .slowDown, .signUpRequired:
      false
    }
  }

  /// It passes on its own, so the learner tries again from the same screen.
  var isShortBreak: Bool {
    if case .slowDown = self {
      return true
    }

    return false
  }
}

struct VoiceRefusal: Error, Equatable, Sendable {
  let status: Int
  let code: String
  let details: OpenAPIValueContainer?

  var isNoSpeech: Bool {
    code == "NO_SPEECH"
  }

  var isPlusRequired: Bool {
    code == "PLUS_REQUIRED"
  }

  /// Mirrors main's `readRefusedLimit`: 403 asks a guest to sign up, 402 a free learner to wait or
  /// subscribe, a 429 is a short break or a subscriber's cap for today.
  var limit: HelpLimit? {
    guard [402, 403, 429].contains(status), !isPlusRequired else {
      return nil
    }

    if code == "SIGN_UP_REQUIRED" {
      return .signUpRequired
    }

    let object = details?.value as? [String: (any Sendable)?]

    if code == "SLOW_DOWN" {
      let value = object?["retryAfterSeconds"] ?? nil
      let seconds = (value as? Int) ?? (value as? Double).map(Int.init) ?? 60
      return .slowDown(retryAfterSeconds: seconds)
    }

    let limit = (object?["limit"] ?? nil) as? [String: (any Sendable)?] ?? object

    let tier =
      ((limit?["tier"] ?? nil) as? String).flatMap(LearnerTier.init)
      ?? (status == 403 ? .guest : status == 402 ? .free : .plus)

    return .reached(
      period: (limit?["period"] ?? nil) as? String, tier: tier,
      opensAt: ((limit?["availableAt"] ?? object?["availableAt"] ?? nil) as? String).flatMap(
        Date.init(serverInstant:)))
  }
}

extension Date {
  /// An instant the server sends as ISO 8601 text, with or without fractions of a second.
  init?(serverInstant text: String) {
    guard
      let date = (try? Date(text, strategy: .iso8601))
        ?? (try? Date(text, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)))
    else {
      return nil
    }

    self = date
  }
}

func voiceRefusal(status: Int, error: Components.Schemas._Error?) -> VoiceRefusal {
  VoiceRefusal(
    status: status,
    code: error?.error.code ?? "",
    details: error?.error.details)
}

/// Transport failures stay errors, which `AppCache.mutate` reads.
enum Refusable<Value: Sendable>: Sendable {
  case done(Value)
  case refused(VoiceRefusal)
}

enum GradeOutcome<Value: Sendable>: Sendable {
  case graded(Value)
  case noSpeech
  case limit(HelpLimit)
  case failed
  case obsolete
}
