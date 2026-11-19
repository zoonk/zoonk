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
    let consumed = dependencies.cache.resource(audience: .signedIn, domains: [.goals]) { _ in 1 }
    await consumed.load()
    let setup = Shown()
    try await readsWhatVoiceOverReads()

    let window = try show(
      SetupHost(shown: setup)
        .appDependencies(dependencies)
        .environment(router)
        .zoonkStyles())

    try await activate(String(localized: "Start lesson 1", table: "AboutYou"), in: window)
    try await waitUntilAnswering(server, in: window)
    setup.isShown = false
    try await waitForTestCondition("Setup did not close") { spoken(in: window).isEmpty }
    await server.release()
    try await waitForTestCondition("The answer did not complete") {
      await server.finished && consumed.isInvalidated
    }

    XCTAssertEqual(router.tasks, [], "Nothing opens once Setup is closed")
  }

  func testASaveThatLandsWhileSetupIsOpenOpensLessonOne() async throws {
    let server = HeldAnswer()
    let router = AppRouter()
    let dependencies = AppDependencies.hosted(transport: server)
    try await readsWhatVoiceOverReads()

    let window = try show(
      SetupHost(shown: Shown())
        .appDependencies(dependencies)
        .environment(router)
        .zoonkStyles())

    try await activate(String(localized: "Start lesson 1", table: "AboutYou"), in: window)
    try await waitUntilAnswering(server, in: window)
    await server.release()
    try await waitForTestCondition("Lesson one did not open") {
      router.tasks == [.lesson(lessonId: HeldAnswer.lessonID)]
    }

    XCTAssertEqual(router.tasks, [.lesson(lessonId: HeldAnswer.lessonID)])
  }

  func testMovingOnClearsAnEarlierStartOverFailure() {
    let failures = GoalSetupFailures()
    failures.startingOver.outcome = true
    XCTAssertTrue(failures.failed)
    failures.clear()
    XCTAssertFalse(failures.failed)
  }

  private func waitUntilAnswering(
    _ server: HeldAnswer, in window: UIWindow, file: StaticString = #filePath, line: UInt = #line
  ) async throws {
    try await waitForTestCondition("The answer never went out") { await server.isAnswering }
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

  private var held: TestContinuation<Void>?
  private(set) var finished = false

  var isAnswering: Bool { held != nil }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    switch operationID {
    case "getOnboarding":
      return Self.json(Self.onboarding)
    case "answerOnboardingQuestion":
      await withTestVoidContinuation { held = $0 }
      finished = true
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
