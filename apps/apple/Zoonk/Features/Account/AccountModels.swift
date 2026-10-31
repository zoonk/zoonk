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

struct AccountSubscription: Decodable, Equatable, Hashable {
  let plan: String
  let provider: String
  let status: String?
  var cancelAt: Date? = nil
  var periodEnd: Date? = nil
}

struct Money: Equatable {
  /// In the currency's major unit: 29.9 is R$ 29,90.
  let amount: Double
  let currency: String

  var formatted: String {
    amount.formatted(.currency(code: currency))
  }
}

struct WebPlusCancellation: Equatable {
  struct Withdrawal: Equatable {
    let refund: Money
    let until: Date
  }

  struct PeriodEnd: Equatable {
    let endsAt: Date
    let refund: Money?
  }

  /// Within 14 days of subscribing: Plus ends now and the whole payment is refunded.
  let withdrawal: Withdrawal?
  /// Stopping the renewal; after a yearly renewal it refunds the months that haven't started.
  let periodEnd: PeriodEnd?
  /// Only the renewal is stopped, so Plus can be kept and renew as before.
  var canResumeRenewal = false
  /// Deleting the account ends Plus right away and refunds this.
  var accountDeletionRefund: Money? = nil
}

enum WebPlusCancellationPreview: Equatable {
  case choices(WebPlusCancellation)
  case nothingToCancel
  case failed
}

enum WebPlusCancellationResult: Equatable {
  case canceled(refund: Money?)
  case choiceClosed
  case failed
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
