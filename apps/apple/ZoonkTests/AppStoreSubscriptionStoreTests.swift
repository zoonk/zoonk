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
      owner: { signedIn("account-a") },
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })

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
      owner: { signedIn("account-a") },
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })

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
      owner: { signedIn("account-a") },
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })

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
      owner: { signedIn("account-a") },
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })

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
      owner: { signedIn("account-a") },
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })

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
      owner: { signedIn("account-a") },
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })

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
      signedTransaction, _ in
      await synchronizationSpy.synchronize(signedTransaction)
    }

    let signedTransactions = await synchronizationSpy.signedTransactions
    let finishCallCount = await finishSpy.callCount

    XCTAssertEqual(signedTransactions, ["signed-transaction"])
    XCTAssertEqual(finishCallCount, 1)
  }

  @MainActor
  func testCurrentEntitlementsSynchronizeTheSameTransactionVersionOnce() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionSynchronizationSpy(result: .synchronizedActive)
    let transaction = makeTransaction(finishSpy: finishSpy)
    let client = AppStoreSubscriptionClientStub(
      currentEntitlements: [transaction, transaction])
    let store = AppStoreSubscriptionStore(client: client)

    await store.reconcileCurrentEntitlements(synchronizationScope: "account-a") {
      signedTransaction, _ in
      await synchronizationSpy.synchronize(signedTransaction)
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
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })

    let signedTransactions = await synchronizationSpy.signedTransactions
    let finishCallCount = await finishSpy.callCount

    XCTAssertEqual(signedTransactions, ["signed-transaction"])
    XCTAssertEqual(finishCallCount, 1)
  }

  @MainActor
  func testPurchaseCompletionAndTransactionUpdateShareOneSynchronization() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SuspendedSubscriptionSynchronizationSpy(result: .synchronizedActive)
    let account = SignedInAccount("account-a")
    let purchaseWaits = Checkpoint()
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

    async let updatesObserved: Void = store.observeTransactionUpdates(
      synchronizationScope: { "account-a" },
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })
    await synchronizationSpy.waitUntilStarted()
    async let purchaseActivated = store.handlePurchase(
      .purchased(purchaseTransaction),
      owner: owner(of: account, reaching: purchaseWaits),
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })
    await purchaseWaits.wait()
    synchronizationSpy.complete()

    let (didActivateSubscription, _) = await (purchaseActivated, updatesObserved)
    let finishCallCount = await finishSpy.callCount

    XCTAssertTrue(didActivateSubscription)
    XCTAssertEqual(synchronizationSpy.signedTransactions, ["update-jws"])
    XCTAssertEqual(finishCallCount, 1)
  }

  @MainActor
  func testSameTransactionForDifferentAccountsNeverSharesInFlightSynchronization() async {
    let accountAFinishSpy = TransactionFinishSpy()
    let accountBFinishSpy = TransactionFinishSpy()
    let accountASynchronizationSpy = SuspendedSubscriptionSynchronizationSpy(
      result: .synchronizedActive)
    let accountBSynchronizationSpy = SubscriptionSynchronizationSpy(result: .accountMismatch)
    let account = SignedInAccount("account-a")
    let accountBWaits = Checkpoint()
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
      owner: { account.owner },
      synchronize: { signedTransaction, _ in
        await accountASynchronizationSpy.synchronize(signedTransaction)
      })
    await accountASynchronizationSpy.waitUntilStarted()
    account.owner = signedIn("account-b")
    async let accountBActivated = store.handlePurchase(
      .purchased(accountBTransaction),
      owner: owner(of: account, reaching: accountBWaits),
      synchronize: { signedTransaction, _ in
        await accountBSynchronizationSpy.synchronize(signedTransaction)
      })
    await accountBWaits.wait()
    accountASynchronizationSpy.complete()

    let (didActivateAccountA, didActivateAccountB) = await (
      accountAActivated,
      accountBActivated
    )
    let accountBSignedTransactions = await accountBSynchronizationSpy.signedTransactions
    let accountAFinishCallCount = await accountAFinishSpy.callCount
    let accountBFinishCallCount = await accountBFinishSpy.callCount

    XCTAssertFalse(didActivateAccountA)
    XCTAssertFalse(didActivateAccountB)
    XCTAssertEqual(accountASynchronizationSpy.signedTransactions, ["account-a-jws"])
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
      signedTransaction, _ in
      await initialSynchronizationSpy.synchronize(signedTransaction)
    }
    await store.restorePurchases(
      owner: { signedIn("account-b") },
      synchronize: { signedTransaction, _ in
        await currentAccountSynchronizationSpy.synchronize(signedTransaction)
      })

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
      owner: { signedIn("account-a") },
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })
    _ = await store.handlePurchase(
      .purchased(
        makeTransaction(
          finishSpy: finishSpy,
          signedDate: Date(timeIntervalSince1970: 2),
          signedTransaction: "updated-jws",
          transactionID: 42)),
      owner: { signedIn("account-a") },
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })

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
      owner: { signedIn("account-a") },
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })
    async let updatedResult = store.handlePurchase(
      .purchased(updatedTransaction),
      owner: { signedIn("account-a") },
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })
    let (initialDidActivate, updatedDidActivate) = await (initialResult, updatedResult)
    let maximumConcurrentCalls = await synchronizationSpy.maximumConcurrentCalls
    let finishCallCount = await finishSpy.callCount

    XCTAssertTrue(initialDidActivate)
    XCTAssertTrue(updatedDidActivate)
    XCTAssertEqual(maximumConcurrentCalls, 1)
    XCTAssertEqual(finishCallCount, 2)
  }

  @MainActor
  func testQueuedTransactionDoesNotSynchronizeAfterTheAccountChanges() async {
    let firstFinishSpy = TransactionFinishSpy()
    let queuedFinishSpy = TransactionFinishSpy()
    let firstSynchronizationSpy = SuspendedSubscriptionSynchronizationSpy(
      result: .synchronizedActive)
    let queuedSynchronizationSpy = SubscriptionSynchronizationSpy(result: .synchronizedActive)
    let store = AppStoreSubscriptionStore(client: AppStoreSubscriptionClientStub())
    let account = SignedInAccount("account-a")
    let queuedPurchaseWaits = Checkpoint()
    let firstTransaction = makeTransaction(
      finishSpy: firstFinishSpy,
      signedTransaction: "first-jws",
      transactionID: 1)
    let queuedTransaction = makeTransaction(
      finishSpy: queuedFinishSpy,
      signedTransaction: "queued-jws",
      transactionID: 2)

    async let firstPurchase = store.handlePurchase(
      .purchased(firstTransaction),
      owner: { account.owner },
      synchronize: { signedTransaction, _ in
        await firstSynchronizationSpy.synchronize(signedTransaction)
      })
    await firstSynchronizationSpy.waitUntilStarted()

    async let queuedPurchase = store.handlePurchase(
      .purchased(queuedTransaction),
      owner: owner(of: account, reaching: queuedPurchaseWaits),
      synchronize: { signedTransaction, expectedAccountID in
        guard account.owner?.accountID == expectedAccountID else {
          return .accountMismatch
        }

        return await queuedSynchronizationSpy.synchronize(signedTransaction)
      })
    await queuedPurchaseWaits.wait()

    account.owner = signedIn("account-b")
    firstSynchronizationSpy.complete()

    let (firstDidActivate, queuedDidActivate) = await (firstPurchase, queuedPurchase)
    let queuedSignedTransactions = await queuedSynchronizationSpy.signedTransactions
    let firstFinishCallCount = await firstFinishSpy.callCount
    let queuedFinishCallCount = await queuedFinishSpy.callCount

    XCTAssertFalse(firstDidActivate)
    XCTAssertFalse(queuedDidActivate)
    XCTAssertEqual(queuedSignedTransactions, [])
    XCTAssertEqual(firstFinishCallCount, 1)
    XCTAssertEqual(queuedFinishCallCount, 0)
    XCTAssertNil(store.alert)
  }

  @MainActor
  func testRestoreSynchronizesCurrentEntitlements() async {
    let finishSpy = TransactionFinishSpy()
    let synchronizationSpy = SubscriptionSynchronizationSpy(result: .synchronizedActive)
    let client = AppStoreSubscriptionClientStub(
      currentEntitlements: [makeTransaction(finishSpy: finishSpy)])
    let store = AppStoreSubscriptionStore(client: client)

    await store.restorePurchases(
      owner: { signedIn("account-a") },
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })

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

    await store.restorePurchases(
      owner: { signedIn("account-a") },
      synchronize: { signedTransaction, _ in
        await synchronizationSpy.synchronize(signedTransaction)
      })

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

    await store.restorePurchases(
      owner: { signedIn("account-a") },
      synchronize: { signedTransaction, _ in
        signedTransaction == "active-jws" ? .synchronizedActive : .synchronizedInactive
      })

    let activeFinishCallCount = await activeFinishSpy.callCount
    let inactiveFinishCallCount = await inactiveFinishSpy.callCount

    XCTAssertEqual(activeFinishCallCount, 1)
    XCTAssertEqual(inactiveFinishCallCount, 1)
    XCTAssertEqual(store.alert, .purchasesRestored)
    XCTAssertFalse(store.isRestoring)
  }

  @MainActor
  func testPurchaseResultIsNotShownAfterTheSameAccountSignsInAgain() async {
    let account = SignedInAccount("account-a")
    let store = AppStoreSubscriptionStore(client: AppStoreSubscriptionClientStub())

    let didActivateSubscription = await store.handlePurchase(
      .purchased(makeTransaction(finishSpy: TransactionFinishSpy())),
      owner: { account.owner },
      synchronize: { _, _ in
        account.owner = signedIn("account-a", token: "replaced")
        return .authenticationRequired
      })

    XCTAssertFalse(didActivateSubscription)
    XCTAssertNil(store.alert)
  }

  @MainActor
  func testRestoreResultIsNotShownAfterTheAccountChanges() async {
    let account = SignedInAccount("account-a")
    let client = AppStoreSubscriptionClientStub(
      currentEntitlements: [makeTransaction(finishSpy: TransactionFinishSpy())])
    let store = AppStoreSubscriptionStore(client: client)

    await store.restorePurchases(
      owner: { account.owner },
      synchronize: { _, _ in
        account.owner = signedIn("account-b")
        return .synchronizedActive
      })

    XCTAssertNil(store.alert)
    XCTAssertFalse(store.isRestoring)
  }

  @MainActor
  func testRestoreWithNoEligiblePurchasesExplainsTheResult() async {
    let store = AppStoreSubscriptionStore(client: AppStoreSubscriptionClientStub())

    await store.restorePurchases(
      owner: { signedIn("account-a") },
      synchronize: { _, _ in
        .synchronizedActive
      })

    XCTAssertEqual(store.alert, .noPurchasesFound)
    XCTAssertFalse(store.isRestoring)
  }

  @MainActor
  func testRestoreFailureRemainsActionable() async {
    let store = AppStoreSubscriptionStore(
      client: AppStoreSubscriptionClientStub(restoreFails: true))

    await store.restorePurchases(
      owner: { signedIn("account-a") },
      synchronize: { _, _ in
        .synchronizedActive
      })

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

  init(result: AccountSubscriptionSynchronizationResult) {
    self.result = result
  }

  func synchronize(_ signedTransaction: String) async -> AccountSubscriptionSynchronizationResult {
    signedTransactions.append(signedTransaction)
    return result
  }
}

@MainActor
private final class SuspendedSubscriptionSynchronizationSpy {
  private(set) var signedTransactions = [String]()
  private let completed = Checkpoint()
  private let result: AccountSubscriptionSynchronizationResult
  private let started = Checkpoint()

  init(result: AccountSubscriptionSynchronizationResult) {
    self.result = result
  }

  func synchronize(_ signedTransaction: String) async
    -> AccountSubscriptionSynchronizationResult
  {
    signedTransactions.append(signedTransaction)
    started.reach()
    await completed.wait()
    return result
  }

  func waitUntilStarted() async {
    await started.wait()
  }

  func complete() {
    completed.reach()
  }
}

@MainActor
private final class Checkpoint {
  private var continuation: CheckedContinuation<Void, Never>?
  private var isReached = false

  func reach() {
    isReached = true
    continuation?.resume()
    continuation = nil
  }

  func wait() async {
    guard !isReached else {
      return
    }

    await withCheckedContinuation { continuation in
      self.continuation = continuation
    }
  }
}

private actor TransactionFinishSpy {
  private(set) var callCount = 0

  func finish() {
    callCount += 1
  }
}

@MainActor
private final class SignedInAccount {
  var owner: AppStoreSubscriptionOwner?

  init(_ accountID: String) {
    owner = signedIn(accountID)
  }
}

/// `handlePurchase` reads its owner and joins the synchronization coordinator in the same main-actor
/// step, so once the checkpoint is reached, that purchase is waiting there.
@MainActor
private func owner(
  of account: SignedInAccount,
  reaching checkpoint: Checkpoint
) -> @MainActor @Sendable () -> AppStoreSubscriptionOwner? {
  {
    checkpoint.reach()
    return account.owner
  }
}

private func signedIn(_ accountID: String, token: String = "token") -> AppStoreSubscriptionOwner {
  AppStoreSubscriptionOwner(
    accountID: accountID,
    session: AuthenticatedSession(bearerToken: "\(accountID)-\(token)"))
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
