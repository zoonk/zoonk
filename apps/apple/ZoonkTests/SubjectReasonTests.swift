import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class SubjectReasonTests: XCTestCase {
  func testSubjectReasonPictures() async throws {
    guard ProcessInfo.processInfo.environment["ZOONK_CALLS_CAPTURE"] != nil else {
      throw XCTSkip("On-demand review pictures")
    }
    try await readsWhatVoiceOverReads()
    for (reason, status) in [
      ("pastBasics", "notPlanned"), ("skippedBase", "notPlanned"), ("skipped", "known"),
    ] {
      try await captureTopic(reason: reason, status: status)
    }
  }

  private func captureTopic(reason: String, status: String) async throws {
    let server = PageServer(holding: nil)
    let (_, body) = try await server.send(
      HTTPRequest(method: .get, scheme: "https", authority: "api.zoonk.test", path: "/"), body: nil,
      baseURL: URL(string: "https://api.zoonk.test")!, operationID: "getGoalSyllabus")
    let bytes = try await Data(collecting: XCTUnwrap(body), upTo: 1_000_000)
    var json = try XCTUnwrap(JSONSerialization.jsonObject(with: bytes) as? [String: Any])
    var subjects = try XCTUnwrap(json["subjects"] as? [[String: Any]])
    subjects[0]["notPlannedReason"] = NSNull()
    subjects[0]["lessonsTotal"] = 1
    subjects[0]["topics"] = [
      [
        "chapters": [], "frequency": NSNull(), "heading": NSNull(), "name": "Cells",
        "notPlannedReason": reason, "status": status,
      ]
    ]
    json["subjects"] = subjects
    json["topicsMapped"] = true
    json["topicCount"] = 1
    let syllabus = try JSONDecoder().decode(
      GoalSyllabus.self, from: JSONSerialization.data(withJSONObject: json))
    let dependencies = AppDependencies(
      clients: APIClientFactory(baseURL: URL(string: "https://api.zoonk.test")!, transport: server),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live(), learnerSummaryAPI: OneGoalSummary(kind: .exam))
    await dependencies.learnerSummaryStore.summary.load()
    let resource = dependencies.planStore.syllabus(goalId: PageServer.goalID)
    await resource.load()
    XCTAssertNotNil(resource.value)
    resource.update { _ in syllabus }
    let window = try show(
      NavigationStack { SubjectScreen(subjectKey: PageServer.subjectKey) }.appDependencies(
        dependencies
      ).environment(AppRouter()).zoonkStyles())
    defer { window.isHidden = true }
    for (size, width, height) in [("phone", 390.0, 844.0), ("large", 1032.0, 1376.0)] {
      window.frame = CGRect(x: 0, y: 0, width: width, height: height)
      window.rootViewController?.traitOverrides.horizontalSizeClass =
        width > 700 ? .regular : .compact
      try await waitForLayout(in: window)
      try await waitForTestCondition("The topic did not appear") {
        spoken(in: window).contains { $0.contains("Cells") }
      }
      try captureCallsRoundTwo("subject-\(status == "known" ? "known" : reason)-\(size)")
    }
  }
}
