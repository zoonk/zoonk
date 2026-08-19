import XCTest

@testable import Zoonk

final class AppStoreSubscriptionStoreTests: XCTestCase {
  @MainActor
  func testVerifiedPurchaseFinishesAfterServerSynchronization() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionSynchronizationSpy(result: .synchronizedActive)
    let store = AppStoreSubscriptionStore(client: AppStoreSubscriptionClientStub())
    let transaction = makeTransaction(finishSpy: finishSpy)

    let didActivateSubscription = await store.handlePurchase(
      .purchased(transaction),
      synchronizationScope: "account-a"
    ) {
      await synchronizationSpy.synchronize($0)
    }

    let signedTransactions = await synchronizationSpy.signedTransactions
    let finishCallCount = await finishSpy.callCount

    XCTAssertTrue(didActivateSubscription)
    XCTAssertEqual(signedTransactions, ["signed-transaction"])
    XCTAssertEqual(finishCallCount, 1)
    XCTAssertNil(store.alert)
  }

  @MainActor
  func testServerFailureLeavesPurchaseUnfinishedForRetry() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionSynchronizationSpy(result: .failed)
    let store = AppStoreSubscriptionStore(client: AppStoreSubscriptionClientStub())

    let didActivateSubscription = await store.handlePurchase(
      .purchased(makeTransaction(finishSpy: finishSpy)),
      synchronizationScope: "account-a"
    ) {
      await synchronizationSpy.synchronize($0)
    }

    let finishCallCount = await finishSpy.callCount

    XCTAssertFalse(didActivateSubscription)
    XCTAssertEqual(finishCallCount, 0)
    XCTAssertEqual(store.alert, .synchronizationFailed)
  }

  @MainActor
  func testAuthenticationExpiryLeavesPurchaseUnfinished() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionSynchronizationSpy(result: .authenticationRequired)
    let store = AppStoreSubscriptionStore(client: AppStoreSubscriptionClientStub())

    let didActivateSubscription = await store.handlePurchase(
      .purchased(makeTransaction(finishSpy: finishSpy)),
      synchronizationScope: "account-a"
    ) {
      await synchronizationSpy.synchronize($0)
    }

    let finishCallCount = await finishSpy.callCount

    XCTAssertFalse(didActivateSubscription)
    XCTAssertEqual(finishCallCount, 0)
    XCTAssertEqual(store.alert, .authenticationRequired)
  }

  @MainActor
  func testPurchaseLinkedToAnotherAccountRemainsUnfinishedWithRecoveryGuidance() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionSynchronizationSpy(result: .accountMismatch)
    let store = AppStoreSubscriptionStore(client: AppStoreSubscriptionClientStub())

    let didActivateSubscription = await store.handlePurchase(
      .purchased(makeTransaction(finishSpy: finishSpy)),
      synchronizationScope: "account-a"
    ) {
      await synchronizationSpy.synchronize($0)
    }

    let finishCallCount = await finishSpy.callCount

    XCTAssertFalse(didActivateSubscription)
    XCTAssertEqual(finishCallCount, 0)
    XCTAssertEqual(store.alert, .accountMismatch)
  }

  @MainActor
  func testServerRejectedPurchaseRemainsUnfinishedWithSupportGuidance() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionSynchronizationSpy(result: .invalidPurchase)
    let store = AppStoreSubscriptionStore(client: AppStoreSubscriptionClientStub())

    let didActivateSubscription = await store.handlePurchase(
      .purchased(makeTransaction(finishSpy: finishSpy)),
      synchronizationScope: "account-a"
    ) {
      await synchronizationSpy.synchronize($0)
    }

    let finishCallCount = await finishSpy.callCount

    XCTAssertFalse(didActivateSubscription)
    XCTAssertEqual(finishCallCount, 0)
    XCTAssertEqual(store.alert, .invalidPurchase)
  }

  @MainActor
  func testUnverifiedPurchaseIsNeverSynchronized() async {
    let synchronizationSpy = SubscriptionSynchronizationSpy(result: .synchronizedActive)
    let store = AppStoreSubscriptionStore(client: AppStoreSubscriptionClientStub())

    let didActivateSubscription = await store.handlePurchase(
      .unverified,
      synchronizationScope: "account-a"
    ) {
      await synchronizationSpy.synchronize($0)
    }

    let signedTransactions = await synchronizationSpy.signedTransactions

    XCTAssertFalse(didActivateSubscription)
    XCTAssertEqual(signedTransactions, [])
    XCTAssertEqual(store.alert, .verificationFailed)
  }

  @MainActor
  func testCurrentEntitlementsSynchronizeAndFinish() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionSynchronizationSpy(result: .synchronizedActive)
    let client = AppStoreSubscriptionClientStub(
      currentEntitlements: [makeTransaction(finishSpy: finishSpy)])
    let store = AppStoreSubscriptionStore(client: client)

    await store.reconcileCurrentEntitlements(synchronizationScope: "account-a") {
      await synchronizationSpy.synchronize($0)
    }

    let signedTransactions = await synchronizationSpy.signedTransactions
    let finishCallCount = await finishSpy.callCount

    XCTAssertEqual(signedTransactions, ["signed-transaction"])
    XCTAssertEqual(finishCallCount, 1)
  }

  @MainActor
  func testTransactionUpdatesSynchronizeAndFinish() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionSynchronizationSpy(result: .synchronizedActive)
    let client = AppStoreSubscriptionClientStub(
      transactionUpdates: [makeTransaction(finishSpy: finishSpy)])
    let store = AppStoreSubscriptionStore(client: client)

    await store.observeTransactionUpdates(
      synchronizationScope: { "account-a" },
      synchronize: { await synchronizationSpy.synchronize($0) })

    let signedTransactions = await synchronizationSpy.signedTransactions
    let finishCallCount = await finishSpy.callCount

    XCTAssertEqual(signedTransactions, ["signed-transaction"])
    XCTAssertEqual(finishCallCount, 1)
  }

  @MainActor
  func testPurchaseCompletionAndTransactionUpdateShareOneSynchronization() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionSynchronizationSpy(
      result: .synchronizedActive,
      yieldsBeforeReturning: true)
    let purchaseTransaction = makeTransaction(
      finishSpy: finishSpy,
      signedTransaction: "purchase-jws",
      transactionID: 42)
    let updateTransaction = makeTransaction(
      finishSpy: finishSpy,
      signedTransaction: "update-jws",
      transactionID: 42)
    let client = AppStoreSubscriptionClientStub(transactionUpdates: [updateTransaction])
    let store = AppStoreSubscriptionStore(client: client)

    async let purchaseActivated = store.handlePurchase(
      .purchased(purchaseTransaction),
      synchronizationScope: "account-a"
    ) {
      await synchronizationSpy.synchronize($0)
    }
    async let updatesObserved: Void = store.observeTransactionUpdates(
      synchronizationScope: { "account-a" },
      synchronize: { await synchronizationSpy.synchronize($0) })
    let (didActivateSubscription, _) = await (purchaseActivated, updatesObserved)
    let signedTransactions = await synchronizationSpy.signedTransactions
    let finishCallCount = await finishSpy.callCount

    XCTAssertTrue(didActivateSubscription)
    XCTAssertEqual(signedTransactions.count, 1)
    XCTAssertTrue(["purchase-jws", "update-jws"].contains(signedTransactions[0]))
    XCTAssertEqual(finishCallCount, 1)
  }

  @MainActor
  func testSameTransactionForDifferentAccountsNeverSharesInFlightSynchronization() async {
    let accountAFinishSpy = TransactionFinishSpy()
    let accountBFinishSpy = TransactionFinishSpy()
    let accountASynchronizationSpy = SuspendedSubscriptionSynchronizationSpy(
      result: .synchronizedActive)
    let accountBSynchronizationSpy = SubscriptionSynchronizationSpy(result: .accountMismatch)
    let store = AppStoreSubscriptionStore(client: AppStoreSubscriptionClientStub())
    let accountATransaction = makeTransaction(
      finishSpy: accountAFinishSpy,
      signedTransaction: "account-a-jws",
      transactionID: 42)
    let accountBTransaction = makeTransaction(
      finishSpy: accountBFinishSpy,
      signedTransaction: "account-b-jws",
      transactionID: 42)

    async let accountAActivated = store.handlePurchase(
      .purchased(accountATransaction),
      synchronizationScope: "account-a"
    ) {
      await accountASynchronizationSpy.synchronize($0)
    }
    await accountASynchronizationSpy.waitUntilStarted()
    async let accountBActivated = store.handlePurchase(
      .purchased(accountBTransaction),
      synchronizationScope: "account-b"
    ) {
      await accountBSynchronizationSpy.synchronize($0)
    }

    for _ in 0..<10 {
      await Task.yield()
    }
    await accountASynchronizationSpy.complete()

    let (didActivateAccountA, didActivateAccountB) = await (
      accountAActivated,
      accountBActivated
    )
    let accountASignedTransactions = await accountASynchronizationSpy.signedTransactions
    let accountBSignedTransactions = await accountBSynchronizationSpy.signedTransactions
    let accountAFinishCallCount = await accountAFinishSpy.callCount
    let accountBFinishCallCount = await accountBFinishSpy.callCount

    XCTAssertTrue(didActivateAccountA)
    XCTAssertFalse(didActivateAccountB)
    XCTAssertEqual(accountASignedTransactions, ["account-a-jws"])
    XCTAssertEqual(accountBSignedTransactions, ["account-b-jws"])
    XCTAssertEqual(accountAFinishCallCount, 1)
    XCTAssertEqual(accountBFinishCallCount, 0)
    XCTAssertEqual(store.alert, .accountMismatch)
  }

  @MainActor
  func testCompletedTransactionChecksTheCurrentAccountBeforeReportingRestore() async {
    let finishSpy = TransactionFinishSpy()
    let initialSynchronizationSpy = SubscriptionSynchronizationSpy(result: .synchronizedActive)
    let currentAccountSynchronizationSpy = SubscriptionSynchronizationSpy(
      result: .accountMismatch)
    let transaction = makeTransaction(finishSpy: finishSpy, transactionID: 42)
    let client = AppStoreSubscriptionClientStub(currentEntitlements: [transaction])
    let store = AppStoreSubscriptionStore(client: client)

    await store.reconcileCurrentEntitlements(synchronizationScope: "account-a") {
      await initialSynchronizationSpy.synchronize($0)
    }
    await store.restorePurchases(synchronizationScope: "account-b") {
      await currentAccountSynchronizationSpy.synchronize($0)
    }

    let initialSignedTransactions = await initialSynchronizationSpy.signedTransactions
    let currentAccountSignedTransactions =
      await currentAccountSynchronizationSpy.signedTransactions
    let finishCallCount = await finishSpy.callCount

    XCTAssertEqual(initialSignedTransactions, ["signed-transaction"])
    XCTAssertEqual(currentAccountSignedTransactions, ["signed-transaction"])
    XCTAssertEqual(finishCallCount, 1)
    XCTAssertEqual(store.alert, .accountMismatch)
  }

  @MainActor
  func testNewerVersionOfTheSameTransactionSynchronizesAgain() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionSynchronizationSpy(result: .synchronizedActive)
    let store = AppStoreSubscriptionStore(client: AppStoreSubscriptionClientStub())

    _ = await store.handlePurchase(
      .purchased(
        makeTransaction(
          finishSpy: finishSpy,
          signedDate: Date(timeIntervalSince1970: 1),
          signedTransaction: "initial-jws",
          transactionID: 42)),
      synchronizationScope: "account-a"
    ) {
      await synchronizationSpy.synchronize($0)
    }
    _ = await store.handlePurchase(
      .purchased(
        makeTransaction(
          finishSpy: finishSpy,
          signedDate: Date(timeIntervalSince1970: 2),
          signedTransaction: "updated-jws",
          transactionID: 42)),
      synchronizationScope: "account-a"
    ) {
      await synchronizationSpy.synchronize($0)
    }

    let signedTransactions = await synchronizationSpy.signedTransactions
    let finishCallCount = await finishSpy.callCount

    XCTAssertEqual(signedTransactions, ["initial-jws", "updated-jws"])
    XCTAssertEqual(finishCallCount, 2)
  }

  @MainActor
  func testDifferentTransactionVersionsNeverSynchronizeConcurrently() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionConcurrencySpy()
    let store = AppStoreSubscriptionStore(client: AppStoreSubscriptionClientStub())
    let initialTransaction = makeTransaction(
      finishSpy: finishSpy,
      signedDate: Date(timeIntervalSince1970: 1),
      signedTransaction: "initial-jws",
      transactionID: 42)
    let updatedTransaction = makeTransaction(
      finishSpy: finishSpy,
      signedDate: Date(timeIntervalSince1970: 2),
      signedTransaction: "updated-jws",
      transactionID: 42)

    async let initialResult = store.handlePurchase(
      .purchased(initialTransaction),
      synchronizationScope: "account-a"
    ) {
      await synchronizationSpy.synchronize($0)
    }
    async let updatedResult = store.handlePurchase(
      .purchased(updatedTransaction),
      synchronizationScope: "account-a"
    ) {
      await synchronizationSpy.synchronize($0)
    }
    let (initialDidActivate, updatedDidActivate) = await (initialResult, updatedResult)
    let maximumConcurrentCalls = await synchronizationSpy.maximumConcurrentCalls
    let finishCallCount = await finishSpy.callCount

    XCTAssertTrue(initialDidActivate)
    XCTAssertTrue(updatedDidActivate)
    XCTAssertEqual(maximumConcurrentCalls, 1)
    XCTAssertEqual(finishCallCount, 2)
  }

  @MainActor
  func testRestoreSynchronizesCurrentEntitlements() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionSynchronizationSpy(result: .synchronizedActive)
    let client = AppStoreSubscriptionClientStub(
      currentEntitlements: [makeTransaction(finishSpy: finishSpy)])
    let store = AppStoreSubscriptionStore(client: client)

    await store.restorePurchases(synchronizationScope: "account-a") {
      await synchronizationSpy.synchronize($0)
    }

    let signedTransactions = await synchronizationSpy.signedTransactions
    let finishCallCount = await finishSpy.callCount

    XCTAssertEqual(signedTransactions, ["signed-transaction"])
    XCTAssertEqual(finishCallCount, 1)
    XCTAssertEqual(store.alert, .purchasesRestored)
    XCTAssertFalse(store.isRestoring)
  }

  @MainActor
  func testRestoreWithOnlyInactivePurchasesDoesNotReportActiveAccess() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionSynchronizationSpy(result: .synchronizedInactive)
    let client = AppStoreSubscriptionClientStub(
      currentEntitlements: [makeTransaction(finishSpy: finishSpy)])
    let store = AppStoreSubscriptionStore(client: client)

    await store.restorePurchases(synchronizationScope: "account-a") {
      await synchronizationSpy.synchronize($0)
    }

    let signedTransactions = await synchronizationSpy.signedTransactions
    let finishCallCount = await finishSpy.callCount

    XCTAssertEqual(signedTransactions, ["signed-transaction"])
    XCTAssertEqual(finishCallCount, 1)
    XCTAssertEqual(store.alert, .noActiveSubscriptionFound)
    XCTAssertFalse(store.isRestoring)
  }

  @MainActor
  func testRestoreWithAnActiveAndInactivePurchaseReportsActiveAccess() async {
    let activeFinishSpy = TransactionFinishSpy()
    let inactiveFinishSpy = TransactionFinishSpy()
    let client = AppStoreSubscriptionClientStub(
      currentEntitlements: [
        makeTransaction(
          finishSpy: inactiveFinishSpy,
          signedTransaction: "inactive-jws",
          transactionID: 1),
        makeTransaction(
          finishSpy: activeFinishSpy,
          signedTransaction: "active-jws",
          transactionID: 2),
      ])
    let store = AppStoreSubscriptionStore(client: client)

    await store.restorePurchases(synchronizationScope: "account-a") { signedTransaction in
      signedTransaction == "active-jws" ? .synchronizedActive : .synchronizedInactive
    }

    let activeFinishCallCount = await activeFinishSpy.callCount
    let inactiveFinishCallCount = await inactiveFinishSpy.callCount

    XCTAssertEqual(activeFinishCallCount, 1)
    XCTAssertEqual(inactiveFinishCallCount, 1)
    XCTAssertEqual(store.alert, .purchasesRestored)
    XCTAssertFalse(store.isRestoring)
  }

  @MainActor
  func testRestoreWithNoEligiblePurchasesExplainsTheResult() async {
    let store = AppStoreSubscriptionStore(client: AppStoreSubscriptionClientStub())

    await store.restorePurchases(synchronizationScope: "account-a") { _ in
      .synchronizedActive
    }

    XCTAssertEqual(store.alert, .noPurchasesFound)
    XCTAssertFalse(store.isRestoring)
  }

  @MainActor
  func testRestoreFailureRemainsActionable() async {
    let store = AppStoreSubscriptionStore(
      client: AppStoreSubscriptionClientStub(restoreFails: true))

    await store.restorePurchases(synchronizationScope: "account-a") { _ in
      .synchronizedActive
    }

    XCTAssertEqual(store.alert, .restoreFailed)
    XCTAssertFalse(store.isRestoring)
  }

  private func makeTransaction(
    finishSpy: TransactionFinishSpy,
    signedDate: Date = Date(timeIntervalSince1970: 1),
    signedTransaction: String = "signed-transaction",
    transactionID: UInt64 = 1
  ) -> AppStoreSubscriptionTransaction {
    AppStoreSubscriptionTransaction(
      productID: AppStoreSubscriptionProduct.plusMonthly,
      signedDate: signedDate,
      signedTransaction: signedTransaction,
      transactionID: transactionID
    ) {
      await finishSpy.finish()
    }
  }
}

private struct AppStoreSubscriptionClientStub: AppStoreSubscriptionClient {
  let currentEntitlementValues: [AppStoreSubscriptionTransaction]
  let restoreFails: Bool
  let transactionUpdateValues: [AppStoreSubscriptionTransaction]

  init(
    currentEntitlements: [AppStoreSubscriptionTransaction] = [],
    restoreFails: Bool = false,
    transactionUpdates: [AppStoreSubscriptionTransaction] = []
  ) {
    currentEntitlementValues = currentEntitlements
    self.restoreFails = restoreFails
    transactionUpdateValues = transactionUpdates
  }

  func currentEntitlements() async -> [AppStoreSubscriptionTransaction] {
    currentEntitlementValues
  }

  func observeTransactionUpdates(
    _ receive: @escaping @Sendable (AppStoreSubscriptionTransaction) async -> Void
  ) async {
    for transaction in transactionUpdateValues {
      await receive(transaction)
    }
  }

  func restorePurchases() async throws {
    if restoreFails {
      throw AppStoreSubscriptionClientStubError.restore
    }
  }
}

private actor SubscriptionSynchronizationSpy {
  private(set) var signedTransactions = [String]()
  private let result: AccountSubscriptionSynchronizationResult
  private let yieldsBeforeReturning: Bool

  init(
    result: AccountSubscriptionSynchronizationResult,
    yieldsBeforeReturning: Bool = false
  ) {
    self.result = result
    self.yieldsBeforeReturning = yieldsBeforeReturning
  }

  func synchronize(_ signedTransaction: String) async -> AccountSubscriptionSynchronizationResult {
    signedTransactions.append(signedTransaction)

    if yieldsBeforeReturning {
      await Task.yield()
    }

    return result
  }
}

private actor SuspendedSubscriptionSynchronizationSpy {
  private(set) var signedTransactions = [String]()
  private let result: AccountSubscriptionSynchronizationResult
  private var completionContinuation: CheckedContinuation<Void, Never>?
  private var didComplete = false
  private var didStart = false
  private var startedContinuation: CheckedContinuation<Void, Never>?

  init(result: AccountSubscriptionSynchronizationResult) {
    self.result = result
  }

  func synchronize(_ signedTransaction: String) async
    -> AccountSubscriptionSynchronizationResult
  {
    signedTransactions.append(signedTransaction)
    didStart = true
    startedContinuation?.resume()
    startedContinuation = nil

    if !didComplete {
      await withCheckedContinuation { continuation in
        completionContinuation = continuation
      }
    }

    return result
  }

  func waitUntilStarted() async {
    guard !didStart else {
      return
    }

    await withCheckedContinuation { continuation in
      startedContinuation = continuation
    }
  }

  func complete() {
    didComplete = true
    completionContinuation?.resume()
    completionContinuation = nil
  }
}

private actor TransactionFinishSpy {
  private(set) var callCount = 0

  func finish() {
    callCount += 1
  }
}

private actor SubscriptionConcurrencySpy {
  private(set) var maximumConcurrentCalls = 0
  private var activeCalls = 0

  func synchronize(_ signedTransaction: String) async
    -> AccountSubscriptionSynchronizationResult
  {
    activeCalls += 1
    maximumConcurrentCalls = max(maximumConcurrentCalls, activeCalls)

    for _ in 0..<10 {
      await Task.yield()
    }

    activeCalls -= 1
    return .synchronizedActive
  }
}

private enum AppStoreSubscriptionClientStubError: Error {
  case restore
}
