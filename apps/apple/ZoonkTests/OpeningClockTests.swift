import SwiftUI
import XCTest

@testable import Zoonk

/// A gate gives its action back at its opening, whatever the screen draws while it's closed.
@MainActor
final class OpeningClockTests: XCTestCase {
  func testAClosedGateThatDrawsNothingGivesItsActionBackAtTheInstant() async throws {
    let opening = Date.now.addingTimeInterval(1)
    let actionBack = expectation(description: "The action came back")
    var cameBackAt: Date?

    // The bar takes its buttons apart and draws nothing while there are none, as course start's does.
    try show(
      Text(verbatim: "Course").bottomBar {
        OpeningClock(availableAt: opening) { now in
          if now >= opening {
            Button {
            } label: {
              Text(verbatim: "Build my plan")
            }
            .onAppear {
              cameBackAt = .now
              actionBack.fulfill()
            }
          }
        }
      })

    await fulfillment(of: [actionBack], timeout: 3)
    XCTAssertLessThan(try XCTUnwrap(cameBackAt).timeIntervalSince(opening), 1)
  }
}
