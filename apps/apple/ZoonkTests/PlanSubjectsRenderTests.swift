import HTTPTypes
import SwiftUI
import XCTest

@testable import Zoonk

/// Review renders of the Plan's subjects table and a subject's page, written only on demand:
/// `TEST_RUNNER_ZOONK_SHOTS=<folder> make -C apps/apple test-mac ONLY_TESTING=ZoonkTests/PlanSubjectsRenderTests`.
@MainActor
final class PlanSubjectsRenderTests: XCTestCase {
  func testWritesRenders() async throws {
    guard let path = ProcessInfo.processInfo.environment["ZOONK_SHOTS"] else {
      throw XCTSkip("Pass TEST_RUNNER_ZOONK_SHOTS=<folder> to write them")
    }

    let folder = URL(fileURLWithPath: path)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

    for exam in [true, false] {
      let syllabus = try Self.syllabus(exam: exam)

      for width in [390.0, 820.0] {
        let window = try show(
          ZoonkList {
            PlanSyllabusSection(goalKind: exam ? .exam : .learn, syllabus: syllabus)
          }
          .environment(AppRouter())
          .zoonkStyles())
        try await write(
          window, width: width, height: 700,
          to: folder.appending(path: "ios-subjects-\(exam ? "exam" : "modules")-\(Int(width)).png"))
      }
    }

    let dependencies = AppDependencies(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: PageServer(holding: nil)),
      session: .preview(account: .planTestAccount), imageLoader: .live(),
      subscriptionStore: .live(), learnerSummaryAPI: OneGoalSummary(kind: .learn))
    await dependencies.learnerSummaryStore.summary.load()
    let resource = dependencies.planStore.syllabus(goalId: PageServer.goalID)
    await resource.load()
    let modules = try Self.syllabus(exam: false)
    resource.update { _ in modules }

    for (size, width, height) in [("phone", 390.0, 844.0), ("large", 1032.0, 900.0)] {
      let window = try show(
        NavigationStack { SubjectScreen(subjectKey: PageServer.subjectKey) }
          .appDependencies(dependencies)
          .environment(AppRouter())
          .zoonkStyles())
      window.rootViewController?.traitOverrides.horizontalSizeClass =
        width > 700 ? .regular : .compact
      try await write(
        window, width: width, height: height,
        to: folder.appending(path: "ios-subject-module-\(size).png"))
    }
  }

  private func write(_ window: UIWindow, width: Double, height: Double, to file: URL) async throws {
    window.frame = CGRect(x: 0, y: 0, width: width, height: height)
    try await waitForLayout(in: window)
    try await Task.sleep(for: .milliseconds(600))

    let format = UIGraphicsImageRendererFormat()
    format.scale = 2
    let image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { _ in
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
    }
    try XCTUnwrap(image.pngData()).write(to: file)
    window.isHidden = true
  }

  private static func syllabus(exam: Bool) throws -> GoalSyllabus {
    func subject(
      _ key: String, _ name: String, done: Int, known: Int, total: Int, questions: Int?,
      preparation: Double?
    ) -> [String: Any] {
      [
        "areas": [], "chapters": [], "covers": [], "displayWeight": NSNull(), "group": NSNull(),
        "imageUrl": NSNull(), "key": key, "lessonsDone": done, "lessonsKnown": known,
        "lessonsTotal": total, "mastery": NSNull(), "matrix": [], "name": name,
        "nextDate": NSNull(), "notPlannedReason": NSNull(),
        "preparation": exam ? (preparation as Any) : NSNull(),
        "questions": exam ? (questions as Any? ?? NSNull()) : NSNull(), "share": NSNull(),
        "sharedWith": [], "shortName": name, "source": "notice", "topicFrequencySource": NSNull(),
        "topics": [], "topicsKnown": NSNull(), "topicsStudied": NSNull(),
      ]
    }

    let json: [String: Any] = [
      "courseWeights": NSNull(), "examDocument": "guide", "fromMaterial": false,
      "goal": [
        "displayName": "Biology", "id": PageServer.goalID, "kind": exam ? "exam" : "learn",
        "title": "Biology",
      ],
      "kind": exam ? "notice" : "modules", "knownTopicsReturn": "practice",
      "lessons": ["done": 9, "known": 6, "total": 50], "noticeUrl": NSNull(),
      "passMarks": NSNull(), "questionsSource": NSNull(), "sharedExams": [],
      "subjects": [
        subject(
          "biology", "Biology", done: 6, known: 4, total: 20, questions: 45, preparation: 0.42),
        subject(
          "chemistry", "Chemistry", done: 3, known: 2, total: 15, questions: 12, preparation: 0.2
        ),
        subject(
          "study-skills", "Study skills", done: 0, known: 0, total: 15, questions: nil,
          preparation: 0.5),
      ],
      "topicCount": 0, "topicsMapped": false, "writtenPractice": NSNull(),
    ]
    return try JSONDecoder().decode(
      GoalSyllabus.self, from: JSONSerialization.data(withJSONObject: json))
  }
}
