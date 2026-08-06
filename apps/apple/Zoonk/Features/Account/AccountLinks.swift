import Foundation

enum AccountLinks {
  static let appleAccountAuthorizations = URL(string: "https://support.apple.com/102571")!
  static let appStoreSubscriptions = URL(string: "https://apps.apple.com/account/subscriptions")!
  static let blog = URL(string: "https://zoonk.com/blog")!
  static let googlePlaySubscriptions = URL(
    string: "https://play.google.com/store/account/subscriptions")!
  static let privacy = URL(string: "https://zoonk.com/privacy")!
  static let support = URL(string: "https://zoonk.com/support")!
  static let terms = URL(string: "https://zoonk.com/terms")!
}

enum StoreSubscriptionProvider: String {
  case apple
  case google

  var managementURL: URL {
    switch self {
    case .apple:
      AccountLinks.appStoreSubscriptions
    case .google:
      AccountLinks.googlePlaySubscriptions
    }
  }
}
