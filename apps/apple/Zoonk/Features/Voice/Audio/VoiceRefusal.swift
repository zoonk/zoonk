import Foundation
import OpenAPIRuntime

/// Mirrors main's `HelpLimit`.
enum HelpLimit: Hashable, Sendable {
  /// A monthly cap is `usedUp`, never a period.
  enum Period: String, Sendable {
    case day
    case total
  }

  case slowDown(retryAfterSeconds: Int)
  /// The day's cap, or what a guest gets for good.
  case limitReached(period: Period, tier: LearnerTier)
  /// A monthly cap: each use comes back 30 days after it was made, and `availableAt` is when the
  /// next one does.
  case usedUp(tier: LearnerTier, availableAt: Date?)
  case signUpRequired

  /// A reached limit as the server names it.
  static func reached(period: String?, tier: LearnerTier, availableAt: Date?) -> HelpLimit {
    switch period {
    case "rolling30Days": .usedUp(tier: tier, availableAt: availableAt)
    case "total": .limitReached(period: .total, tier: tier)
    default: .limitReached(period: .day, tier: tier)
    }
  }

  var tier: LearnerTier? {
    switch self {
    case .limitReached(_, let tier), .usedUp(let tier, _): tier
    case .slowDown, .signUpRequired: nil
    }
  }

  var needsAccount: Bool {
    self == .signUpRequired || tier == .guest
  }

  var offersSubscription: Bool {
    tier == .free
  }

  /// It passes on its own, so the learner tries again from the same screen.
  var isShortBreak: Bool {
    if case .slowDown = self {
      return true
    }

    return false
  }

  var isMonthly: Bool {
    if case .usedUp = self {
      return true
    }

    return false
  }

  /// When a monthly cap's next use comes back.
  var availableAt: Date? {
    if case .usedUp(_, let availableAt) = self {
      return availableAt
    }

    return nil
  }

  /// Main's opening day `"open"`: the instant has passed, so only the server can say whether the
  /// learner is still at the limit. Only their tap asks again.
  func isOpen(at now: Date) -> Bool {
    availableAt.map { $0 <= now } ?? false
  }

  /// The way to try is on the screen: a short break passes, and a cap's day has come. The server
  /// decides again.
  func letsTry(at now: Date) -> Bool {
    isShortBreak || isOpen(at: now)
  }
}

struct VoiceRefusal: Error, Equatable, Sendable {
  let status: Int
  let code: String
  let details: OpenAPIValueContainer?
  /// When this device received it, which its instant is read against.
  var receivedAt = Date.now

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
      availableAt: Date(
        opening: (limit?["availableAt"] ?? object?["availableAt"] ?? nil) as? String,
        receivedAt: receivedAt))
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

  /// Main's `useOpeningDay` with `receivedAt`: a refusal's instant as this device received it. One
  /// already past by then came from a server whose clock is behind this device's, so its day can't
  /// be told here: there is none, and the refusal stands until the next try.
  init?(opening text: String?, receivedAt: Date) {
    guard let text, let date = Date(serverInstant: text), date > receivedAt else {
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
