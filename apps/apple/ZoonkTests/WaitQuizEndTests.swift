import SwiftUI
import XCTest

@testable import Zoonk

/// A failed run ends its wait: the quiz goes whole, whatever the learner was doing in it, and the
/// progress says what happened. After "Try again" a fresh card may be dealt.
@MainActor
final class WaitQuizEndTests: XCTestCase {
  func testAnOpenQuizGoesWholeWhenTheRunFails() async throws {
    try await failsWhileQuizzing(answered: false)
  }

  func testAnAnsweredQuizGoesWholeWhenTheRunFails() async throws {
    try await failsWhileQuizzing(answered: true)
  }

  func testOnlyALostConnectionLeavesTheWaitGoing() {
    XCTAssertFalse(GenerationFailure.connection.endsWait)
    XCTAssertTrue(GenerationFailure.generation.endsWait)
    XCTAssertTrue(GenerationFailure.notStarted.endsWait)
  }

  private func failsWhileQuizzing(answered: Bool) async throws {
    let run = Run()
    let session = SessionStore.preview(account: .planTestAccount)
    let warmUps = WarmUpStore(api: DeckStub(), cache: AppCache(session: session))
    try readsWhatVoiceOverReads()
    let window = try show(
      NavigationStack {
        RunWait(run: run)
      }
      .environment(WaitVisit(surface: .planWait))
      .environment(warmUps)
      .environment(session)
      .environment(AppRouter())
      .zoonkStyles())
    try await settle()
    XCTAssertTrue(shows("First question?", in: window), "The quiz: \(spoken(in: window))")

    if answered {
      try activate("Right", in: window)
      try await settle()
      XCTAssertTrue(shows("Because.", in: window), "Its answer: \(spoken(in: window))")
    }

    run.ended = true
    try await settle()

    for gone in ["First question?", "Right", "Wrong", "Because."] {
      XCTAssertFalse(shows(gone, in: window), "\(gone) went: \(spoken(in: window))")
    }
    XCTAssertTrue(shows("It stopped.", in: window), "The progress says so")

    run.ended = false
    try await settle()

    let next = answered ? "Second question?" : "First question?"
    XCTAssertTrue(shows(next, in: window), "A card afresh: \(spoken(in: window))")
    XCTAssertFalse(shows("Because.", in: window), "with no answer")
  }

  private func shows(_ words: String, in window: UIWindow) -> Bool {
    spoken(in: window).contains { $0.contains(words) }
  }

  private func settle() async throws {
    try await Task.sleep(for: .milliseconds(400))
  }
}

@MainActor
@Observable
private final class Run {
  var ended = false
}

private struct RunWait: View {
  let run: Run

  var body: some View {
    WaitScreen(
      deck: WaitDeck(id: DeckStub.deckID), progressTitle: Text(verbatim: "Building"),
      ended: run.ended
    ) {
      Text(verbatim: "Status")
    } progress: {
      Text(verbatim: run.ended ? "It stopped." : "Going.")
    }
  }
}

private struct DeckStub: WarmUpAPIClient {
  static let deckID = "00000000-0000-4000-8000-0000000000e1"

  func deck(id: String, token: String) async throws -> WarmUpDeck? {
    try JSONDecoder().decode(
      WarmUpDeck.self,
      from: Data(
        #"""
        {"id":"\#(Self.deckID)","language":"en","cards":[
          {"id":"c1","question":"First question?","reveal":"Because.","options":[
            {"id":"a","text":"Right","correct":true},{"id":"b","text":"Wrong","correct":false}]},
          {"id":"c2","question":"Second question?","reveal":"So.","options":[
            {"id":"c","text":"Yes","correct":true},{"id":"d","text":"No","correct":false}]}
        ]}
        """#.utf8))
  }
}
