import OpenAPIRuntime
import XCTest

@testable import Zoonk

/// A refusal is read as this device received it. An instant already past by then came from a server
/// whose clock is behind this device's: no day can be told here, so the gate stays, with no day and
/// no "You can try again now.", until the next try. One received before its instant opens once the
/// instant passes.
final class RefusalReceivedTests: XCTestCase {
  /// Nov 22, 2026, 09:30 UTC.
  private let opens = Date(timeIntervalSince1970: 1_795_339_800)
  private let details =
    #"{"limit":{"period":"rolling30Days","tier":"free","availableAt":"2026-11-22T09:30:00.000Z"}}"#

  private var late: Date { opens.addingTimeInterval(60) }
  private var early: Date { opens.addingTimeInterval(-60) }

  func testAHelpRefusalPastOnArrivalKeepsItsGateWithNoDay() throws {
    let pastOnArrival = try XCTUnwrap(refusal(429, "USAGE_LIMIT_REACHED", receivedAt: late).limit)

    XCTAssertEqual(pastOnArrival, .usedUp(tier: .free, availableAt: nil))
    XCTAssertFalse(pastOnArrival.isOpen(at: late.addingTimeInterval(3600)))
    XCTAssertEqual(
      pastOnArrival.words(.messages, now: late).said, "You've used your messages")

    let beforeItsDay = try XCTUnwrap(
      refusal(429, "USAGE_LIMIT_REACHED", receivedAt: early).limit)

    XCTAssertEqual(beforeItsDay, .usedUp(tier: .free, availableAt: opens))
    XCTAssertTrue(beforeItsDay.isOpen(at: late))
  }

  func testACallRefusalPastOnArrivalKeepsItsGateWithNoDay() {
    XCTAssertEqual(
      CallReservation(refusal: refusal(429, "CONVERSATION_LIMIT_REACHED", receivedAt: late)),
      .limit(.usedUp(tier: .free, availableAt: nil)))
    XCTAssertEqual(
      CallReservation(refusal: refusal(429, "CONVERSATION_LIMIT_REACHED", receivedAt: early)),
      .limit(.usedUp(tier: .free, availableAt: opens)))
  }

  func testATutorRefusalPastOnArrivalKeepsItsGateWithNoDay() throws {
    let error = try JSONDecoder().decode(
      Components.Schemas._Error.self,
      from: Data(
        #"{"error":{"code":"USAGE_LIMIT_REACHED","message":"Limit reached","details":\#(details)}}"#
          .utf8))

    XCTAssertEqual(
      TutorFailure(refusal: error, fallback: .failed, receivedAt: late),
      .limit(.usedUp(tier: .free, availableAt: nil)))
    XCTAssertEqual(
      TutorFailure(refusal: error, fallback: .failed, receivedAt: early),
      .limit(.usedUp(tier: .free, availableAt: opens)))
  }

  private func refusal(_ status: Int, _ code: String, receivedAt: Date) -> VoiceRefusal {
    VoiceRefusal(
      status: status, code: code,
      details: try? JSONDecoder().decode(OpenAPIValueContainer.self, from: Data(details.utf8)),
      receivedAt: receivedAt)
  }
}
