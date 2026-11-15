import SwiftUI
import XCTest

@testable import Zoonk

/// A limit keeps the practice call's shape: one action in Start's place, and nothing moves when
/// the limit lifts.
@MainActor
final class PracticeCallTests: XCTestCase {
  func testEachStateHoldsOneActionInStartsPlace() {
    let later = Date.now.addingTimeInterval(3600)
    let action = { (limit: HelpLimit?, isLocked: Bool) in
      PracticeCallAction(limit: limit, isLocked: isLocked, isWriting: false)
    }

    XCTAssertEqual(action(.usedUp(tier: .free, availableAt: later), false), .subscribe)
    XCTAssertEqual(action(.limitReached(period: .total, tier: .guest), false), .signUp)
    XCTAssertEqual(
      action(.usedUp(tier: .plus, availableAt: later), false), .start(isEnabled: false))
    XCTAssertEqual(action(.usedUp(tier: .free, availableAt: later), true), .subscribe)
    XCTAssertEqual(action(nil, true), .subscribe)
    XCTAssertEqual(action(nil, false), .start(isEnabled: true))
  }

  /// A subscriber's Start turns on at the instant, in the place it held, with the line's room kept.
  func testTheSectionStaysStillWhenItsLimitLifts() async throws {
    let opening = Date.now.addingTimeInterval(1)
    let conversation = try JSONDecoder().decode(
      LanguageUnit.Conversation.self,
      from: Data(
        """
        {"character": null, "defaultMinutes": 5, "minutes": [], "paused": false,
         "plusMinutes": [], "limit": {"period": "rolling30Days", "tier": "plus",
         "availableAt": \(opening.timeIntervalSinceReferenceDate)}}
        """.utf8))
    var nextRow: [CGFloat] = []
    let session = SessionStore.preview(account: Self.account)
    let clients = APIClientFactory.live(baseURL: AppConfiguration.current.apiBaseURL)

    try show(
      List {
        PracticeCallSection(
          conversation: conversation, chapterId: "chapter", goalId: nil, minutes: .constant(nil),
          start: CallStart(), onStarted: { _ in })

        Section {
          Text(verbatim: "Words")
            .onGeometryChange(for: CGFloat.self, of: { $0.frame(in: .global).minY }) {
              nextRow.append($0)
            }
        }
      }
      .environment(
        LearnerSummaryStore(
          api: LearnerSummaryAPI(clients: clients), cache: AppCache(session: session))
      )
      .environment(VoiceServices(clients: clients, cache: AppCache(session: session)))
      .environment(AppRouter()))

    try await Task.sleep(for: .seconds(2.5))

    XCTAssertEqual(nextRow.count, 1, "The next row moved: \(nextRow)")
  }

  private static let account = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test", id: "learner", image: nil, name: "Learner", username: nil))
}
