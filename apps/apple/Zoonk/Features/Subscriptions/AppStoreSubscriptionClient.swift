import StoreKit

struct AppStoreSubscriptionTransactionVersion: Hashable, Sendable {
  let signedDate: Date
  let transactionID: UInt64
}

struct AppStoreSubscriptionTransaction: Sendable {
  let productID: String
  let signedDate: Date
  let signedTransaction: String
  let transactionID: UInt64

  private let finishAction: @Sendable () async -> Void

  init(
    productID: String,
    signedDate: Date,
    signedTransaction: String,
    transactionID: UInt64,
    finish: @escaping @Sendable () async -> Void
  ) {
    self.productID = productID
    self.signedDate = signedDate
    self.signedTransaction = signedTransaction
    self.transactionID = transactionID
    finishAction = finish
  }

  func finish() async {
    await finishAction()
  }

  var version: AppStoreSubscriptionTransactionVersion {
    AppStoreSubscriptionTransactionVersion(
      signedDate: signedDate,
      transactionID: transactionID)
  }
}

enum AppStoreSubscriptionPurchaseOutcome: Sendable {
  case cancelled
  case failed
  case pending
  case purchased(AppStoreSubscriptionTransaction)
  case unverified
}

protocol AppStoreSubscriptionClient: Sendable {
  func currentEntitlements() async -> [AppStoreSubscriptionTransaction]
  func observeTransactionUpdates(
    _ receive: @escaping @Sendable (AppStoreSubscriptionTransaction) async -> Void
  ) async
  func restorePurchases() async throws
}

struct StoreKitSubscriptionClient: AppStoreSubscriptionClient {
  /// Includes unfinished deliveries because Zoonk finishes verified transactions only after
  /// the shared account server records them; current entitlements cover later sign-ins and restores.
  func currentEntitlements() async -> [AppStoreSubscriptionTransaction] {
    let unfinished = await collectVerifiedTransactions(from: Transaction.unfinished)
    let current = await collectCurrentEntitlements()

    return unfinished + current
  }

  func observeTransactionUpdates(
    _ receive: @escaping @Sendable (AppStoreSubscriptionTransaction) async -> Void
  ) async {
    for await verification in Transaction.updates {
      guard let transaction = Self.makeTransaction(from: verification) else {
        continue
      }

      await receive(transaction)
    }
  }

  func restorePurchases() async throws {
    try await AppStore.sync()
  }

  static func purchaseOutcome(
    from result: Result<Product.PurchaseResult, Error>
  ) -> AppStoreSubscriptionPurchaseOutcome {
    switch result {
    case .failure:
      return .failed
    case .success(let purchaseResult):
      switch purchaseResult {
      case .pending:
        return .pending
      case .userCancelled:
        return .cancelled
      case .success(let verification):
        guard let transaction = makeTransaction(from: verification) else {
          return .unverified
        }

        return .purchased(transaction)
      @unknown default:
        return .failed
      }
    }
  }

  private func collectCurrentEntitlements() async -> [AppStoreSubscriptionTransaction] {
    if #available(iOS 18.4, *) {
      return await collectCurrentEntitlementsByProduct()
    }

    return await collectVerifiedTransactions(from: Transaction.currentEntitlements)
  }

  @available(iOS 18.4, *)
  private func collectCurrentEntitlementsByProduct() async -> [AppStoreSubscriptionTransaction] {
    var transactions = [AppStoreSubscriptionTransaction]()

    for productID in AppStoreSubscriptionProduct.productIDs {
      let productTransactions = await collectVerifiedTransactions(
        from: Transaction.currentEntitlements(for: productID))
      transactions.append(contentsOf: productTransactions)
    }

    return transactions
  }

  private func collectVerifiedTransactions(
    from values: Transaction.Transactions
  ) async -> [AppStoreSubscriptionTransaction] {
    var transactions = [AppStoreSubscriptionTransaction]()

    for await verification in values {
      guard let transaction = Self.makeTransaction(from: verification) else {
        continue
      }

      transactions.append(transaction)
    }

    return transactions
  }

  private static func makeTransaction(
    from verification: VerificationResult<Transaction>
  ) -> AppStoreSubscriptionTransaction? {
    guard case .verified(let transaction) = verification,
      AppStoreSubscriptionProduct.isSupported(transaction.productID)
    else {
      return nil
    }

    return AppStoreSubscriptionTransaction(
      productID: transaction.productID,
      signedDate: transaction.signedDate,
      signedTransaction: verification.jwsRepresentation,
      transactionID: transaction.id
    ) {
      await transaction.finish()
    }
  }
}
