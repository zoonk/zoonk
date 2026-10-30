import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

@MainActor
final class MockEssayGradingTests: XCTestCase {
  func testGradeItComesBackOnceTheLearnersDayTurns() async {
    let clock = TestClock(at(day: 29, hour: 22))
    let run = makeRun(transport: GradesUsedUpTransport(holdsGrading: false), clock: clock)

    await run.gradeEssays()
    run.offerGradingOnANewDay()
    XCTAssertEqual(
      run.essayGrading, .limitReached(on: DateComponents(year: 2026, month: 10, day: 29)))

    clock.now = at(day: 30, hour: 8)
    run.offerGradingOnANewDay()
    XCTAssertEqual(run.essayGrading, .idle)
  }

  func testALimitAnsweredAfterMidnightCountsForTheDayItWasAskedOn() async {
    let transport = GradesUsedUpTransport(holdsGrading: true)
    let clock = TestClock(at(day: 29, hour: 23, minute: 59))
    let run = makeRun(transport: transport, clock: clock)

    let grading = Task { await run.gradeEssays() }
    await transport.waitForHeldGrading()
    clock.now = at(day: 30, hour: 0, minute: 1)
    await transport.release()
    await grading.value
    guard case .limitReached = run.essayGrading else {
      return XCTFail("the day's essay grades were used up")
    }

    clock.now = at(day: 30, hour: 8)
    run.offerGradingOnANewDay()
    XCTAssertEqual(run.essayGrading, .idle)
  }

  func testALimitKeepsTheCalendarDayItWasAskedOnAcrossTimeZones() async {
    let home = NSTimeZone.default
    defer { NSTimeZone.default = home }
    NSTimeZone.default = TimeZone(identifier: "America/Los_Angeles")!
    let clock = TestClock(at(day: 29, hour: 22))
    let run = makeRun(transport: GradesUsedUpTransport(holdsGrading: false), clock: clock)

    await run.gradeEssays()
    NSTimeZone.default = TimeZone(identifier: "America/New_York")!
    clock.now = at(day: 30, hour: 6)
    run.offerGradingOnANewDay()

    XCTAssertEqual(run.essayGrading, .idle)
  }

  private func makeRun(transport: some ClientTransport, clock: TestClock) -> MockRun {
    let api = ExamAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: transport))
    let store = ExamStore(
      api: api, cache: AppCache(session: .preview(account: .mockEssayGradingTestFixture)))
    return MockRun(store: store, blockId: Self.blockId) { clock.now }
  }

  private func at(day: Int, hour: Int, minute: Int = 0) -> Date {
    Calendar.current.date(
      from: DateComponents(year: 2026, month: 10, day: day, hour: hour, minute: minute))!
  }

  private static let baseURL = URL(string: "https://api.zoonk.test")!
  private static let blockId = "01a18235-e60e-7dbb-a938-b0ae54987c58"
}

private final class TestClock {
  var now: Date

  init(_ now: Date) {
    self.now = now
  }
}

/// Every grading answers that the day's essay grades are used up.
private actor GradesUsedUpTransport: ClientTransport {
  private let holdsGrading: Bool
  private var held: CheckedContinuation<Void, Never>?

  init(holdsGrading: Bool) {
    self.holdsGrading = holdsGrading
  }

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    let grading = operationID == "gradeMockEssays"

    if grading, holdsGrading {
      await withCheckedContinuation { held = $0 }
    }

    let status: HTTPResponse.Status = grading ? .tooManyRequests : .notFound

    return (
      HTTPResponse(status: status, headerFields: [.contentType: "application/json"]),
      HTTPBody(#"{"error":{"code":"LIMIT","message":"No more today"}}"#)
    )
  }

  func waitForHeldGrading() async {
    while held == nil {
      await Task.yield()
    }
  }

  func release() {
    held?.resume()
    held = nil
  }
}

extension CurrentAccount {
  fileprivate static let mockEssayGradingTestFixture = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      displayUsername: "learner", email: "learner@zoonk.test", id: "mock-essay-grading-test-user",
      image: nil, name: "Learner", username: "learner"))
}
