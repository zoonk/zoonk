import Foundation

struct CurrentAccount: Decodable, Equatable {
  var account: AccountAccess
  let user: AccountUser

  var needsProfileSetup: Bool {
    user.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || user.username == nil
  }
}

struct AccountAccess: Decodable, Equatable {
  let deletion: AccountDeletionRequirements
  var subscription: AccountSubscription?
}

struct AccountDeletionRequirements: Decodable, Equatable {
  let hasAppleAccount: Bool
}

struct AccountSubscription: Decodable, Equatable, Hashable {
  let plan: String
  let provider: String
  let status: String?
  /// When a subscription set to end ends: the date it was set to end, or the end of its paid period
  /// once its renewal is stopped.
  var endsAt: Date? = nil
  var periodEnd: Date? = nil
}

/// Plus bought on the website, which can sit beside a newer store purchase.
struct WebPlus: Decodable, Equatable {
  enum State: String, Decodable {
    case renewing
    case ending
    /// The renewal payment failed, so canceling ends Plus right away and stops the retries.
    case unpaid
  }

  let state: State
  /// When renewing Plus would end if canceled, or when ending Plus ends; nil when unpaid.
  let periodEnd: Date?
}

struct AppleSubscriptionSynchronization: Equatable {
  let account: CurrentAccount
  let isActive: Bool
}

struct AccountUser: Decodable, Equatable {
  let displayUsername: String?
  let email: String
  let id: String
  let image: String?
  let name: String
  let username: String?

  var preferredName: String {
    let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmedName.isEmpty ? email : trimmedName
  }
}

struct AppleSignInCredentials {
  let authorizationCode: String
  let email: String?
  let firstName: String?
  let identityToken: String
  let lastName: String?
  let nonce: String
}

struct AccountDeletionResponse: Decodable, Equatable {
  let appleAuthorizationRevoked: Bool?
}

struct EmailReauthenticationCredentials: Encodable {
  let email: String
  let otp: String
}

enum AccountDeletionResult: Equatable {
  case deleted
  case deletedWithManualAppleRevocation
  case emailReauthenticationRequired
  case failed
  case signedOut
}

enum AccountSessionState: Equatable {
  case restoring
  case signedOut
  case signedIn(CurrentAccount)
  case unavailable

  var account: CurrentAccount? {
    if case .signedIn(let account) = self { account } else { nil }
  }
}

enum AccountFailure: Equatable {
  case botDetected
  case emailCodeDelivery
  case accountDeletion
  case accountMismatch
  case disposableEmail
  case invalidCode
  case invalidEmail
  case network
  case rateLimited
  case signIn
  case usernameTaken
  case validation
}
