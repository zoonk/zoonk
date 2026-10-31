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
  case signUpRequired

  var needsAccount: Bool {
    switch self {
    case .signUpRequired:
      true
    case .limitReached(_, let tier):
      tier == .guest
    case .slowDown:
      false
    }
  }

  var offersPlus: Bool {
    if case .limitReached(_, .free) = self {
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
  /// get Plus, a 429 is a short break or Plus's cap for today.
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
    let period = ((limit?["period"] ?? nil) as? String).flatMap(HelpLimit.Period.init) ?? .day

    let tier =
      ((limit?["tier"] ?? nil) as? String).flatMap(LearnerTier.init)
      ?? (status == 403 ? .guest : status == 402 ? .free : .plus)

    return .limitReached(period: period, tier: tier)
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
