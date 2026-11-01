import Foundation

enum AccountLinks {
  static let appleAccountAuthorizations = URL(string: "https://support.apple.com/102571")!
  static let blog = URL(string: "https://www.zoonk.com/blog")!
  static let fairUse = URL(string: "https://www.zoonk.com/terms#fair-use")!
  static let privacy = URL(string: "https://www.zoonk.com/privacy")!
  static let support = URL(string: "https://www.zoonk.com/support")!
  static let terms = URL(string: "https://www.zoonk.com/terms")!
}

enum StoreSubscriptionProvider: String {
  case apple
  case google
}
