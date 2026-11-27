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
      TutorFailure(refused: 402, error: error, receivedAt: late),
      .limit(.usedUp(tier: .free, availableAt: nil)))
    XCTAssertEqual(
      TutorFailure(refused: 402, error: error, receivedAt: early),
      .limit(.usedUp(tier: .free, availableAt: opens)))
  }

  /// A short break ends its wait after this device received it, and its line counts the wait down,
  /// in minutes over a minute and in seconds under one, until it can be tried again.
  func testAShortBreakCountsItsWaitDownFromWhenItArrived() throws {
    let slowDown = try XCTUnwrap(
      VoiceRefusal(
        status: 429, code: "SLOW_DOWN",
        details: try JSONDecoder().decode(
          OpenAPIValueContainer.self, from: Data(#"{"retryAfterSeconds":90}"#.utf8)),
        receivedAt: opens
      ).limit)

    XCTAssertEqual(slowDown.breakEnd, opens.addingTimeInterval(90))

    func line(after seconds: TimeInterval) -> String {
      slowDown.words(.messages, now: opens.addingTimeInterval(seconds)).said
    }

    XCTAssertEqual(line(after: 0), "Take a short break. You can try again in 2 minutes.")
    XCTAssertEqual(line(after: 30), "Take a short break. You can try again in 1 minute.")
    XCTAssertEqual(line(after: 31), "Take a short break. You can try again in 59 seconds.")
    XCTAssertEqual(line(after: 89.5), "Take a short break. You can try again in 1 second.")
    XCTAssertEqual(line(after: 90), "You can try again now.")
  }

  /// A short break nothing timed counts from when its notice first shows.
  func testAShortBreakNothingTimedCountsFromWhenItShows() {
    let shown = HelpLimit.slowDown(retryAfterSeconds: 30).started(at: opens)

    XCTAssertEqual(shown.breakEnd, opens.addingTimeInterval(30))
    XCTAssertEqual(
      shown.words(now: opens.addingTimeInterval(20)).said,
      "Take a short break. You can try again in 10 seconds.")
    XCTAssertEqual(shown.started(at: opens.addingTimeInterval(5)), shown)
  }

  private func refusal(_ status: Int, _ code: String, receivedAt: Date) -> VoiceRefusal {
    VoiceRefusal(
      status: status, code: code,
      details: try? JSONDecoder().decode(OpenAPIValueContainer.self, from: Data(details.utf8)),
      receivedAt: receivedAt)
  }
}
