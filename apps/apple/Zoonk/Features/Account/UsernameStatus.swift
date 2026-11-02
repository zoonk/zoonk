import Foundation

struct UsernameCheck: Equatable {
  let username: String
  let status: UsernameStatus
}

/// Main's `useUsernameAvailability`: a check that didn't answer leaves the field `idle`, so saving
/// decides.
enum UsernameStatus: Equatable {
  case available
  case checking
  case idle
  case invalid
  case taken

  private static let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789_")

  static func isWellFormed(_ username: String) -> Bool {
    3...30 ~= username.count && username.unicodeScalars.allSatisfy { allowed.contains($0) }
  }

  static func of(_ username: String, current: String, check: UsernameCheck?) -> UsernameStatus {
    if username.isEmpty || username == current {
      return .idle
    }

    if !isWellFormed(username) {
      return .invalid
    }

    guard let check, check.username == username else {
      return .checking
    }

    return check.status
  }

  var canSave: Bool {
    self == .idle || self == .available
  }
}
