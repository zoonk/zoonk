enum AppStoreSubscriptionProduct {
  static let plusMonthly = "com.zoonk.plus.monthly"
  static let plusYearly = "com.zoonk.plus.yearly"
  static let productIDs = [plusMonthly, plusYearly]

  static func isSupported(_ productID: String) -> Bool {
    productIDs.contains(productID)
  }
}
