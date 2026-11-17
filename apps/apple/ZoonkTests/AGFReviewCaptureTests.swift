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
    let exploring = environment["ZOONK_ACTIVITY_GALLERY_EXPLORE"] != nil
    let input = try XCTUnwrap(environment["AGF_CAPTURE_INPUT"])
    let fixtureData = try Data(contentsOf: URL(fileURLWithPath: input))
    let fixtures = try JSONDecoder().decode([String: JSONValue].self, from: fixtureData)
    let window = try XCTUnwrap(
      UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first)
    let previous = window.rootViewController
    defer { window.rootViewController = previous }
    let folder = URL(fileURLWithPath: output, isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    let scenarios: [(String, String, Double, Bool, Bool)] =
      ["r4", "r5", "r6"].contains(environment["AGF_CAPTURE_SET"] ?? "")
      ? [
        ("map-light", "mapExplorer", 0, false, false),
        ("map-dark", "mapExplorer", 0, true, false),
        ("map-narrow-large", "mapExplorer", 0, false, true),
        ("line-crossing", "lineCrossing", 0, false, false),
        ("break-even", "lineCrossing.breakEven", 0, false, false),
        ("line-crossing-narrow-large", "lineCrossing", 0, false, true),
        ("break-even-narrow-large", "lineCrossing.breakEven", 0, false, true),
        ("guess-money", "guessReveal.money", 900, false, false),
        ("guess-money-millions", "guessReveal.moneyMillions", 900_000, false, false),
        ("guess-money-narrow-large", "guessReveal.money", 900, false, true),
        ("guess-money-millions-narrow-large", "guessReveal.moneyMillions", 900_000, false, true),
      ]
      : [
        ("guess-one", "guessReveal", 1, false, false),
        ("guess-off", "guessReveal", 10, false, false),
        ("guess-money", "guessReveal.money", 900, false, false),
        ("map", "mapExplorer", 0, false, false),
      ]
    let selected =
      environment["AGF_CAPTURE_SET"] == "r6"
      ? scenarios.filter { $0.1 == "mapExplorer" } : scenarios
    for (name, fixture, answer, dark, large) in selected {
      let data = try XCTUnwrap(fixtures[fixture])
      let content = try XCTUnwrap(data["content"]).decode(as: ActivityStepContent.self)
      let map = try? data["baseMap"]?.decode(as: ActivityBaseMap.self)
      let isMap = fixture == "mapExplorer"
      let isLine = fixture.hasPrefix("lineCrossing")
      let context = ActivityCanvasContext(
        template: content.template, payload: content.payload,
        check: exploring ? nil : content.check,
        phase: exploring ? .explore : (isMap || isLine ? .answering : .checked(isCorrect: false)),
        answer: isMap || isLine ? nil : .numeric(answer), setAnswer: { _ in }, baseMap: map)
      let renderer: ActivityRenderer
      if isMap {
        renderer = .mapExplorer
      } else if isLine {
        renderer = try XCTUnwrap(ChartsActivities.renderers.first { $0.template == "lineCrossing" })
      } else {
        renderer = .guessReveal
      }
      let host = UIHostingController(
        rootView: NavigationStack {
          ScrollView {
            VStack(alignment: .leading, spacing: 16) {
              if !large { Text(verbatim: content.prompt).typeStyle(.body.weight(.semibold)) }
              renderer.canvas(context)
            }.padding()
          }
        }.frame(maxWidth: large ? 320 : .infinity)
          .environment(\.dynamicTypeSize, large ? .accessibility2 : .large)
          .environment(\.colorScheme, dark ? .dark : .light)
          .environment(ActivityWork()).zoonkStyles())
      host.overrideUserInterfaceStyle = dark ? .dark : .light
      host.traitOverrides.preferredContentSizeCategory = large ? .accessibilityExtraLarge : .large
      window.traitOverrides.preferredContentSizeCategory = large ? .accessibilityExtraLarge : .large
      window.overrideUserInterfaceStyle = dark ? .dark : .light
      window.rootViewController = host
      window.makeKeyAndVisible()
      try await Task.sleep(for: .milliseconds(600))
      window.layoutIfNeeded()
      var record = LayoutCaptureWriter.capture(
        scenario: name, screen: "activity-" + fixture,
        picture: folder.appending(path: name + ".png"))
      record["plotLabelFont"] = [
        "normal": TypeStyle.data.uiFont(.large, legibility: nil).pointSize,
        "actual": TypeStyle.data.uiFont(large ? .accessibility2 : .large, legibility: nil)
          .pointSize,
      ]
      if large {
        XCTAssertGreaterThanOrEqual(
          TypeStyle.data.uiFont(.accessibility2, legibility: nil).pointSize,
          TypeStyle.data.uiFont(.large, legibility: nil).pointSize * 2)
      }
      XCTAssertNil(record["error"])
      try JSONSerialization.data(withJSONObject: record, options: [.sortedKeys]).write(
        to: folder.appending(path: name + ".json"))
    }
  }
}
