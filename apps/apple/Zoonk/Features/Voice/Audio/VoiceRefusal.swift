import Foundation
import OpenAPIRuntime

/// Why small AI help (grading a spoken answer, voicing a clip) isn't given now: fair use asks for a
/// short break, the plan's help for the day or the month is used up, or a guest is asked to create
/// an account once the day's budget all guests share is spent. Port of main's `HelpLimit`.
enum HelpLimit: Equatable, Sendable {
  enum Period: String, Sendable {
    case day
    case month
    case total
  }

  case slowDown(retryAfterSeconds: Int)
  case limitReached(period: Period, tier: LearnerTier)
  case signUpRequired

  /// Whether the one thing to do is creating a free account.
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

  /// Whether getting Plus lifts it: a free learner's cap.
  var offersPlus: Bool {
    if case .limitReached(_, .free) = self {
      return true
    }

    return false
  }
}

/// A refusal the API explained: its HTTP status, its stable `code` and its `details`. Voice screens
/// read it in the learner's terms (`noSpeech`, `limit`, `plusRequired`).
struct VoiceRefusal: Error, Equatable, Sendable {
  let status: Int
  let code: String
  let details: OpenAPIValueContainer?

  /// The recording had no words in it (`NO_SPEECH`).
  var isNoSpeech: Bool {
    code == "NO_SPEECH"
  }

  /// The call or task comes with Plus.
  var isPlusRequired: Bool {
    code == "PLUS_REQUIRED"
  }

  /// A metered request's cap, as main's `readRefusedLimit` reads it: 403 asks a guest to sign up,
  /// 402 a free learner to wait or get Plus, a 429 is a short break or Plus's cap for today.
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

/// Reads an API error envelope into a `VoiceRefusal`.
func voiceRefusal(status: Int, error: Components.Schemas._Error?) -> VoiceRefusal {
  VoiceRefusal(
    status: status,
    code: error?.error.code ?? "",
    details: error?.error.details)
}

/// A write the API did, or refused with a reason the screen explains (no words heard, a limit,
/// Plus). Transport failures stay errors, which `AppCache.mutate` reads.
enum Refusable<Value: Sendable>: Sendable {
  case done(Value)
  case refused(VoiceRefusal)
}

/// How grading a recording came out, in the terms a recorder explains.
enum GradeOutcome<Value: Sendable>: Sendable {
  case graded(Value)
  case noSpeech
  case limit(HelpLimit)
  case failed
  /// The learner who recorded it is gone or the screen closed: show nothing.
  case obsolete
}
