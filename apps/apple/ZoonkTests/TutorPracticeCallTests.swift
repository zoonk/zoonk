import SwiftUI
import XCTest

@testable import Zoonk

/// RV90: a practice call the buddy offered beside a lesson, set up while the window crosses the
/// width where the lesson's Ask is a pane. The offer's pane can go; the call's sheet, and a start
/// under way in it, stay.
@MainActor
final class TutorPracticeCallTests: XCTestCase {
  func testThePracticeCallStaysWhenTheOffersPaneGoes() async throws {
    try await staysOpen(from: 1376, to: 420)
  }

  func testThePracticeCallStaysWhenTheOffersPaneComes() async throws {
    try await staysOpen(from: 420, to: 1376)
  }

  private func staysOpen(from: CGFloat, to: CGFloat) async throws {
    let offer = try JSONDecoder().decode(
      Components.Schemas.TutorToolOffer.self,
      from: Data(
        #"""
        {"kind":"conversationCall","chapterId":"00000000-0000-4000-8000-0000000000c1",
         "goalId":"00000000-0000-4000-8000-0000000000a1","unitTitle":"At the market",
         "call":{"character":null,"defaultMinutes":5,"minutes":[],"paused":false,
                 "plusMinutes":[],"limit":null}}
        """#.utf8))
    let router = AppRouter()
    let session = SessionStore.preview(account: Self.account)
    let clients = APIClientFactory.live(baseURL: AppConfiguration.current.apiBaseURL)
    try readsWhatVoiceOverReads()

    let window = try show(
      PaneSplit {
        Color.clear
      } secondary: {
        TutorToolOfferCard(offer: offer)
      } single: {
        TutorToolOfferCard(offer: offer)
      }
      .sheet(item: router.sheet(presentedBy: 0)) { sheet in
        AppSheetView(sheet: sheet)
      }
      .environment(\.tutorPlaces, .routed(by: router))
      .environment(router)
      .environment(session)
      .environment(
        LearnerSummaryStore(
          api: LearnerSummaryAPI(clients: clients), cache: AppCache(session: session))
      )
      .environment(VoiceServices(clients: clients, cache: AppCache(session: session)))
      .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: from, height: 1032)
    try await settle()

    try activate(String(localized: "Practice", table: "Tutor"), in: window)
    try await settle()
    XCTAssertTrue(callShows(in: window), "The call's sheet opens")

    window.frame = CGRect(x: 0, y: 0, width: to, height: 1032)
    try await settle()

    XCTAssertTrue(callShows(in: window), "The call's sheet stays")
  }

  private func callShows(in window: UIWindow) -> Bool {
    guard let sheet = window.rootViewController?.presentedViewController else {
      return false
    }

    return spoken(in: sheet.view).contains { $0.contains("At the market") }
  }

  private func settle() async throws {
    try await Task.sleep(for: .milliseconds(600))
  }

  private static let account = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test", id: "learner", image: nil, name: "Learner", username: nil))
}
