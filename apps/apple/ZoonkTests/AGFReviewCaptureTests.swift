import SwiftUI
import XCTest

@testable import Zoonk

final class AGFReviewCaptureTests: XCTestCase {
  @MainActor
  func testCaptureReviewScenarios() async throws {
    let environment = ProcessInfo.processInfo.environment
    guard let output = environment["AGF_CAPTURE_OUT"] else {
      throw XCTSkip("On-demand review capture")
    }
    let input = try XCTUnwrap(environment["AGF_CAPTURE_INPUT"])
    let fixtureData = try Data(contentsOf: URL(fileURLWithPath: input))
    let fixtures = try JSONDecoder().decode([String: JSONValue].self, from: fixtureData)
    let window = try XCTUnwrap(
      UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first)
    let previous = window.rootViewController
    defer { window.rootViewController = previous }
    let folder = URL(fileURLWithPath: output, isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    for (name, fixture, answer) in [
      ("guess-one", "guessReveal", 1.0), ("guess-off", "guessReveal", 10.0),
      ("guess-money", "guessReveal.money", 900.0), ("map", "mapExplorer", 0.0),
    ] {
      let data = try XCTUnwrap(fixtures[fixture])
      let content = try XCTUnwrap(data["content"]).decode(as: ActivityStepContent.self)
      let map = try? data["baseMap"]?.decode(as: ActivityBaseMap.self)
      let isMap = fixture == "mapExplorer"
      let context = ActivityCanvasContext(
        template: content.template, payload: content.payload, check: content.check,
        phase: isMap ? .answering : .checked(isCorrect: false),
        answer: isMap ? nil : .numeric(answer), setAnswer: { _ in }, baseMap: map)
      let renderer = isMap ? ActivityRenderer.mapExplorer : ActivityRenderer.guessReveal
      let host = UIHostingController(
        rootView: NavigationStack {
          ScrollView {
            VStack(alignment: .leading, spacing: 16) {
              Text(verbatim: content.prompt).typeStyle(.body.weight(.semibold))
              renderer.canvas(context)
            }.padding()
          }
        }.environment(ActivityWork()).zoonkStyles())
      window.rootViewController = host
      window.makeKeyAndVisible()
      try await Task.sleep(for: .milliseconds(600))
      window.layoutIfNeeded()
      let record = LayoutCaptureWriter.capture(
        scenario: name, screen: "activity-" + fixture,
        picture: folder.appending(path: name + ".png"))
      XCTAssertNil(record["error"])
      try JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]).write(
        to: folder.appending(path: name + ".json"))
    }
  }
}
