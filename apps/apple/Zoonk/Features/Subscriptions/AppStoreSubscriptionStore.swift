import Observation

enum AccountSubscriptionSynchronizationResult: Equatable, Sendable {
  case accountMismatch
  case authenticationRequired
  case failed
  case invalidPurchase
  case synchronizedActive
  case synchronizedInactive

  var isDurablySynchronized: Bool {
    switch self {
    case .synchronizedActive, .synchronizedInactive:
      return true
    case .accountMismatch, .authenticationRequired, .failed, .invalidPurchase:
      return false
    }
  }
}

enum AppStoreSubscriptionAlert: Equatable {
  case accountMismatch
  case authenticationRequired
  case invalidPurchase
  case noActiveSubscriptionFound
  case noPurchasesFound
  case purchaseFailed
  case purchasesRestored
  case restoreFailed
  case synchronizationFailed
  case verificationFailed
}

@MainActor
@Observable
final class AppStoreSubscriptionStore {
  private(set) var alert: AppStoreSubscriptionAlert?
  private(set) var isRestoring = false

  private let client: any AppStoreSubscriptionClient
  private let synchronizationCoordinator = AppStoreSubscriptionSynchronizationCoordinator()

  init(client: any AppStoreSubscriptionClient) {
    self.client = client
  }

  static func live() -> AppStoreSubscriptionStore {
    AppStoreSubscriptionStore(client: StoreKitSubscriptionClient())
  }

  func handlePurchase(
    _ outcome: AppStoreSubscriptionPurchaseOutcome,
    synchronizationScope: String?,
    synchronize:
      @escaping @MainActor @Sendable (String) async
      -> AccountSubscriptionSynchronizationResult
  ) async -> Bool {
    switch outcome {
    case .cancelled, .pending:
      return false
    case .failed:
      alert = .purchaseFailed
      return false
    case .unverified:
      alert = .verificationFailed
      return false
    case .purchased(let transaction):
      let result = await synchronizationCoordinator.process(
        transaction: transaction,
        synchronizationScope: synchronizationScope,
        synchronize: synchronize)
      alert = getAlert(for: result)
      return result == .synchronizedActive
    }
  }

  func observeTransactionUpdates(
    synchronizationScope:
      @escaping @MainActor @Sendable () -> String?,
    synchronize:
      @escaping @MainActor @Sendable (String) async
      -> AccountSubscriptionSynchronizationResult
  ) async {
    let synchronizationCoordinator = synchronizationCoordinator

    await client.observeTransactionUpdates { transaction in
      let currentSynchronizationScope = await synchronizationScope()
      _ = await synchronizationCoordinator.process(
        transaction: transaction,
        synchronizationScope: currentSynchronizationScope,
        synchronize: synchronize)
    }
  }

  func reconcileCurrentEntitlements(
    synchronizationScope: String?,
    synchronize:
      @escaping @MainActor @Sendable (String) async
      -> AccountSubscriptionSynchronizationResult
  ) async {
    _ = await synchronizeCurrentEntitlements(
      synchronizationScope: synchronizationScope,
      using: synchronize)
  }

  func restorePurchases(
    synchronizationScope: String?,
    synchronize:
      @escaping @MainActor @Sendable (String) async
      -> AccountSubscriptionSynchronizationResult
  ) async {
    guard !isRestoring else {
      return
    }

    isRestoring = true
    alert = nil
    defer { isRestoring = false }

    do {
      try await client.restorePurchases()
      let results = await synchronizeCurrentEntitlements(
        synchronizationScope: synchronizationScope,
        using: synchronize)
      alert = getRestoreAlert(for: results)
    } catch {
      alert = .restoreFailed
    }
  }

  func clearAlert() {
    alert = nil
  }

  private func synchronizeCurrentEntitlements(
    synchronizationScope: String?,
    using synchronize:
      @escaping @MainActor @Sendable (String) async
      -> AccountSubscriptionSynchronizationResult
  ) async -> [AccountSubscriptionSynchronizationResult] {
    let transactions = await client.currentEntitlements()
    let synchronizationCoordinator = synchronizationCoordinator

    return await synchronizeTransactions(
      transactions,
      with: synchronizationCoordinator,
      synchronizationScope: synchronizationScope,
      using: synchronize)
  }

  private func getAlert(
    for result: AccountSubscriptionSynchronizationResult
  ) -> AppStoreSubscriptionAlert? {
    switch result {
    case .accountMismatch:
      return .accountMismatch
    case .authenticationRequired:
      return .authenticationRequired
    case .failed:
      return .synchronizationFailed
    case .invalidPurchase:
      return .invalidPurchase
    case .synchronizedActive:
      return nil
    case .synchronizedInactive:
      return .noActiveSubscriptionFound
    }
  }

  private func getRestoreAlert(
    for results: [AccountSubscriptionSynchronizationResult]
  ) -> AppStoreSubscriptionAlert {
    if results.isEmpty {
      return .noPurchasesFound
    }

    if results.contains(.accountMismatch) {
      return .accountMismatch
    }

    if results.contains(.authenticationRequired) {
      return .authenticationRequired
    }

    if results.contains(.invalidPurchase) {
      return .invalidPurchase
    }

    if results.contains(.failed) {
      return .synchronizationFailed
    }

    if results.contains(.synchronizedActive) {
      return .purchasesRestored
    }

    return .noActiveSubscriptionFound
  }
}

private func synchronizeTransactions(
  _ transactions: [AppStoreSubscriptionTransaction],
  with coordinator: AppStoreSubscriptionSynchronizationCoordinator,
  synchronizationScope: String?,
  using synchronize:
    @escaping @MainActor @Sendable (String) async
    -> AccountSubscriptionSynchronizationResult
) async -> [AccountSubscriptionSynchronizationResult] {
  var results = [AccountSubscriptionSynchronizationResult]()

  for transaction in transactions {
    results.append(
      await coordinator.process(
        transaction: transaction,
        synchronizationScope: synchronizationScope,
        synchronize: synchronize))
  }

  return results
}

private struct AppStoreSubscriptionSynchronizationKey: Hashable, Sendable {
  /// Account scope prevents a synchronization for one Zoonk user from being reused after an
  /// account switch.
  let synchronizationScope: String?
  let transactionVersion: AppStoreSubscriptionTransactionVersion
}

private actor AppStoreSubscriptionSynchronizationCoordinator {
  private var inFlightSynchronizations = [
    AppStoreSubscriptionSynchronizationKey: Task<AccountSubscriptionSynchronizationResult, Never>
  ]()
  /// Distinct StoreKit events must update the shared account snapshot in order, even when completion, updates, and launch reconciliation arrive together.
  private var synchronizationTail: Task<Void, Never>?

  func process(
    transaction: AppStoreSubscriptionTransaction,
    synchronizationScope: String?,
    synchronize:
      @escaping @MainActor @Sendable (String) async
      -> AccountSubscriptionSynchronizationResult
  ) async -> AccountSubscriptionSynchronizationResult {
    let synchronizationKey = AppStoreSubscriptionSynchronizationKey(
      synchronizationScope: synchronizationScope,
      transactionVersion: transaction.version)

    if let inFlightSynchronization = inFlightSynchronizations[synchronizationKey] {
      return await inFlightSynchronization.value
    }

    let previousSynchronization = synchronizationTail
    let synchronization = Task {
      await previousSynchronization?.value
      let result = await synchronize(transaction.signedTransaction)

      // Keep failed deliveries unfinished so StoreKit can offer them again after authentication
      // or network recovery.
      if result.isDurablySynchronized {
        await transaction.finish()
      }

      return result
    }
    inFlightSynchronizations[synchronizationKey] = synchronization
    synchronizationTail = Task {
      _ = await synchronization.value
    }

    let result = await synchronization.value
    inFlightSynchronizations[synchronizationKey] = nil
    return result
  }
}
