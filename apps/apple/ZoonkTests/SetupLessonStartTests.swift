import Foundation
import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import XCTest

@testable import Zoonk

/// "Start lesson 1" from an About you question saves its answer first. The learner closes Setup
/// while it saves: the answer lands, and nothing opens over wherever they went.
@MainActor
final class SetupLessonStartTests: XCTestCase {
  func testASaveThatLandsAfterSetupClosedOpensNothing() async throws {
    let server = HeldAnswer()
    let router = AppRouter()
    let dependencies = AppDependencies.hosted(transport: server)
    let setup = Shown()
    try readsWhatVoiceOverReads()

    let window = try show(
      SetupHost(shown: setup)
        .appDependencies(dependencies)
        .environment(router)
        .zoonkStyles())
    try await settle()

    try activate(String(localized: "Start lesson 1", table: "AboutYou"), in: window)
    try await waitUntilAnswering(server, in: window)
    setup.isShown = false
    try await settle()
    await server.release()
    try await settle()

    XCTAssertEqual(router.tasks, [], "Nothing opens once Setup is closed")
  }

  func testASaveThatLandsWhileSetupIsOpenOpensLessonOne() async throws {
    let server = HeldAnswer()
    let router = AppRouter()
    let dependencies = AppDependencies.hosted(transport: server)
    try readsWhatVoiceOverReads()

    let window = try show(
      SetupHost(shown: Shown())
        .appDependencies(dependencies)
        .environment(router)
        .zoonkStyles())
    try await settle()

    try activate(String(localized: "Start lesson 1", table: "AboutYou"), in: window)
    try await waitUntilAnswering(server, in: window)
    await server.release()
    try await settle()

    XCTAssertEqual(router.tasks, [.lesson(lessonId: HeldAnswer.lessonID)])
  }

  private func settle() async throws {
    try await Task.sleep(for: .milliseconds(500))
  }

  private func waitUntilAnswering(_ server: HeldAnswer, in window: UIWindow) async throws {
    let deadline = ContinuousClock.now + .seconds(5)

    while await !server.isAnswering, ContinuousClock.now < deadline {
      try await Task.sleep(for: .milliseconds(100))
    }

    let answering = await server.isAnswering ? true : nil
    _ = try XCTUnwrap(answering, "The answer never went out: \(spoken(in: window))")
  }

}

@MainActor
@Observable
private final class Shown {
  var isShown = true
}

private struct SetupHost: View {
  let shown: Shown

  var body: some View {
    if shown.isShown {
      NavigationStack {
        GoalSetupContent(goalID: HeldAnswer.goalID)
      }
    }
  }
}

/// Setup on an About you question with lesson 1 ready; its answer waits for `release()`.
private actor HeldAnswer: ClientTransport {
  static let goalID = "00000000-0000-4000-8000-000000000001"
  static let lessonID = "00000000-0000-4000-8000-0000000000f1"

  private var held: CheckedContinuation<Void, Never>?

  var isAnswering: Bool { held != nil }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    switch operationID {
    case "getOnboarding":
      return Self.json(Self.onboarding)
    case "answerOnboardingQuestion":
      await withCheckedContinuation { held = $0 }
      return Self.json(Self.onboarding)
    default:
      throw APIError.network
    }
  }

  func release() {
    held?.resume()
    held = nil
  }

  private static func json(_ text: String) -> (HTTPResponse, HTTPBody?) {
    (
      HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
      HTTPBody(text)
    )
  }

  private static let onboarding = #"""
    {"profile":{"memoryEnabled":true,"questions":[{"id":"watch","options":[{"description":null,"id":"documentaries","label":"Documentaries"}],"saved":{"picks":["documentaries"],"studies":[],"text":""},"status":"answered","version":1}]},"contentCountry":{"defaultCountry":{"code":"US","name":"United States"},"suggested":[]},"dateProblem":null,"examChoices":[],"examDays":null,"examSubjects":[],"firstLesson":{"id":"00000000-0000-4000-8000-0000000000f1","status":"ready","title":"Lesson one"},"followUps":[],"generationId":null,"goal":{"contentCountry":null,"countryDependent":false,"createdAt":"2026-11-08T00:00:00.000Z","dailyMinutes":15,"details":{},"examBlueprintId":null,"examCountry":null,"examplesCountry":null,"id":"00000000-0000-4000-8000-000000000001","isActive":true,"kind":"learn","language":"en","languageCountry":{"code":"US","name":"United States"},"languageFlag":null,"plan":null,"primaryCourseId":null,"prompt":"Vaccines","regionChoices":[],"status":"active","studyDays":[],"suggested":[],"studyTime":null,"targetDate":null,"targetLanguage":null,"targetRegion":null,"timezone":null,"title":"Vaccines","displayName":"Vaccines"},"goalIds":[],"languageAim":null,"libraryCourse":null,"planReadiness":{"readingNotice":false,"ready":false},"planRevealed":false,"quickTestMinutes":0,"recommendedMinutes":15,"startsOnRecommended":false,"steps":["watch"],"timeChoices":[],"warmUp":null}
    """#
}
