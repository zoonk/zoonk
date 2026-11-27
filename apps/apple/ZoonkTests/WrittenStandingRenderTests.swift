import SwiftUI
import XCTest

@testable import Zoonk

/// Review renders of where a written estimate stands (the score sheet and a mock's result), an
/// answer graded by level, the line counter and the marker past the line limit, written only on
/// demand: `TEST_RUNNER_ZOONK_SHOTS=<folder> make -C apps/apple test-mac
/// ONLY_TESTING=ZoonkTests/WrittenStandingRenderTests`.
@MainActor
final class WrittenStandingRenderTests: XCTestCase {
  private static let states: [(name: String, standing: String, range: String)] = [
    ("met", "met", #"{"low":56,"high":63}"#),
    ("below", "below", #"{"low":41,"high":47}"#),
    ("overlaps", "overlaps", #"{"low":47,"high":54}"#),
    ("unmeasured", "unmeasured", #"{"low":56,"high":63}"#),
    ("no-estimate", "unmeasured", "null"),
  ]

  private static let prompt = """
    {"charactersPerLine":87,"keySource":"notice","lines":30,"maxCharactersPerLine":160,\
    "minimumWords":30,"points":100,"taskKey":"q1","title":"Internal and external control",\
    "unit":"answer","criteria":[{"id":"c1","name":"Argument","points":40},\
    {"id":"c2","name":"Cohesion","points":30},{"id":"c3","name":"Language","points":30}]}
    """

  func testWritesRenders() async throws {
    guard let path = ProcessInfo.processInfo.environment["ZOONK_SHOTS"] else {
      throw XCTSkip("Pass TEST_RUNNER_ZOONK_SHOTS=<folder> to write them")
    }

    let folder = URL(fileURLWithPath: path)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    let store = ExamStore(
      api: ExamAPI(
        clients: APIClientFactory(
          baseURL: URL(string: "https://api.zoonk.test")!, transport: PageServer(holding: nil))),
      cache: AppCache(session: .preview(account: .planTestAccount)))

    for state in Self.states {
      let part = """
        {"name":"Written test","max":100,"minimum":{"unit":"points","value":50},\
        "range":\(state.range),"standing":"\(state.standing)","scale":"points","decimals":0,\
        "tasks":[{"key":"q1","name":"Question 1","max":100,"range":\(state.range)}]}
        """
      let projection = try decode(
        WrittenProjection.self,
        """
        {"objective":{"low":62,"high":68},"objectiveMax":100,"max":200,\
        "combined":\(state.range == "null" ? "null" : #"{"low":118,"high":131}"#),"parts":[\(part)]}
        """)
      try await write(
        ZoonkList { WrittenProjectionSections(projection: projection, goalId: "goal") }
          .environment(store).environment(AppRouter()),
        height: 600, to: folder.appending(path: "ios-overview-\(state.name).png"))

      let objective = """
        "asked":260,"earned":182,"max":260,"met":true,"projected":null,"short":null
        """
      let points = try decode(
        MockPoints.self,
        """
        {\(objective),"minimum":{"unit":"points","value":130},"unjudged":[],\
        "parts":[{\(objective),"minimum":{"unit":"points","value":130},"name":"Objective test",\
        "qualifying":false}],"written":[\(part.replacingOccurrences(of: "Written test", with: "Discursive test"))]}
        """)
      try await write(
        ZoonkList { MockPointsSection(points: points) },
        height: 360, to: folder.appending(path: "ios-mock-\(state.name).png"))
    }

    let levels = try decode(
      WritingResult.self,
      """
      {"kind":"levels","criteria":[{"comment":"Loose.","id":"c1","level":"partial","name":"Argument","quote":null},\
      {"comment":"Linked.","id":"c2","level":"strong","name":"Cohesion","quote":null},\
      {"comment":"Few slips.","id":"c3","level":"strong","name":"Language","quote":null}],\
      "errors":[],"ignoredFrom":null,"nextStep":null,"progress":null}
      """)
    let prompt = try decode(WritingPrompt.self, Self.prompt)
    try await write(
      ZoonkList { WritingResultSections(grade: levels, prompt: prompt, text: "Cities grow.") },
      height: 1100, to: folder.appending(path: "ios-result-levels.png"))

    let line = "Control keeps public power accountable. "
    for (name, lines) in [("fits", 20), ("may-not-fit", 36), ("over", 60)] {
      let essay = try decode(
        EssayView.self,
        """
        {"blockId":"00000000-0000-4000-8000-0000000000b1","context":null,"drafts":[],"draft":null,\
        "gradesLeft":6,"pacing":{"minutes":70,"source":"estimated"},"question":"Write it.",\
        "sessionId":"01a1fac7-1f46-7548-a88d-e54152b01cad","status":"active","writing":\(Self.prompt)}
        """)
      let writer = EssayWriter(store: store, view: essay, admissionId: nil)
      writer.write(String(repeating: line, count: lines * 87 / line.count))
      try await write(
        NavigationStack { WritingEditorPage(writer: writer, essay: essay, onSend: {}) },
        height: 844, to: folder.appending(path: "ios-counter-\(name).png"))
    }

    let text = String(repeating: line, count: 60 * 87 / line.count)
    let past = WritingLines.count(
      text, charactersPerLine: 87, maxCharactersPerLine: 160, limit: 30
    ).ignoredFrom
    let cut = try decode(
      WritingResult.self,
      WritingLinesTests.levels(ignoredFrom: past, errors: "[]"))
    try await write(
      ZoonkList { WritingMarkedTextSection(grade: cut, lines: prompt.lines, text: text) },
      height: 1600, to: folder.appending(path: "ios-result-not-read.png"))
  }

  private func write(_ view: some View, height: Double, to file: URL) async throws {
    let window = try show(view.zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 390, height: height)
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

  private func decode<Value: Decodable>(_ type: Value.Type, _ json: String) throws -> Value {
    try JSONDecoder().decode(type, from: Data(json.utf8))
  }
}
