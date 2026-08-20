import Foundation

struct CurrentAccount: Decodable, Equatable {
  let account: AccountAccess
  let user: AccountUser

  var needsProfileSetup: Bool {
    user.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || user.username == nil
  }
}

struct AccountAccess: Decodable, Equatable {
  let deletion: AccountDeletionRequirements
  let subscription: AccountSubscription?

  var subscriptionAction: AccountSubscriptionAction {
    guard let subscription else {
      return .subscribe
    }

    switch StoreSubscriptionProvider(rawValue: subscription.provider) {
    case .apple:
      return .manageAppStore
    case .google:
      return .explainGooglePlayManagement
    case nil:
      return .contactSupport
    }
  }
}

enum AccountSubscriptionAction: Equatable {
  case contactSupport
  case explainGooglePlayManagement
  case manageAppStore
  case subscribe
}

struct AccountDeletionRequirements: Decodable, Equatable {
  let hasAppleAccount: Bool
}

struct AccountSubscription: Decodable, Equatable {
  let plan: String
  let provider: String
  let status: String?
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
}

enum AccountFailure: Equatable {
  case accountDeletion
  case accountMismatch
  case invalidCode
  case invalidEmail
  case network
  case rateLimited
  case signIn
  case usernameTaken
  case validation
}
