import XCTest

@testable import Zoonk

@MainActor
final class PracticeCallTests: XCTestCase {
  func testEachStateHoldsOneActionInStartsPlace() {
    let later = Date.now.addingTimeInterval(3600)
    let action = { (limit: HelpLimit?, isLocked: Bool) in
      PracticeCallAction(limit: limit, isLocked: isLocked, isWriting: false)
    }
    let freeUsedUp = HelpLimit.usedUp(tier: .free, availableAt: later)
    let guest = HelpLimit.limitReached(period: .total, tier: .guest)

    XCTAssertEqual(action(freeUsedUp, false), .wayOn(freeUsedUp))
    XCTAssertEqual(action(guest, false), .wayOn(guest))
    XCTAssertEqual(action(guest, true), .wayOn(guest))
    XCTAssertEqual(
      action(.usedUp(tier: .plus, availableAt: later), false), .start(isEnabled: false))
    XCTAssertEqual(action(freeUsedUp, true), .wayOn(freeUsedUp))
    XCTAssertEqual(action(nil, true), .subscribe)
    XCTAssertEqual(action(nil, false), .start(isEnabled: true))
  }

  /// A short break has no way on of its own, so a length only subscribers get still offers one.
  func testALockedLengthOffersASubscriptionDuringAShortBreak() {
    let slowDown = HelpLimit.slowDown(until: .now.addingTimeInterval(30))

    XCTAssertEqual(
      PracticeCallAction(limit: slowDown, isLocked: true, isWriting: false), .subscribe)
    XCTAssertEqual(
      PracticeCallAction(limit: slowDown, isLocked: false, isWriting: false),
      .start(isEnabled: false))
  }
}
