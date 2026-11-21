import SwiftUI
import XCTest

@testable import Zoonk

/// What VoiceOver reads from a plot, and review renders of plots and charts on phones, written only on demand:
/// `TEST_RUNNER_ZOONK_SHOTS=<folder> make -C apps/apple test ONLY_TESTING=ZoonkTests/LessonPlotRenderTests`.
/// No goldens: people and agents look at them.
@MainActor
final class LessonPlotRenderTests: XCTestCase {
  func testReadsTheTitleOnce() async throws {
    try await readsWhatVoiceOverReads()
    let control = try Self.visual(Self.control)
    let window = try show(LessonVisualView(visual: control).padding(16))

    try await waitForTestCondition("The plot never showed: \(spoken(in: window))") {
      spoken(in: window).contains { $0.contains("Horizontal axis") }
    }
    XCTAssertEqual(
      spoken(in: window).filter { $0.contains("Bottle fill weight") }.count, 1,
      "\(spoken(in: window))")
  }

  func testWritesRenders() async throws {
    guard let path = ProcessInfo.processInfo.environment["ZOONK_SHOTS"] else {
      throw XCTSkip("Pass TEST_RUNNER_ZOONK_SHOTS=<folder> to write them")
    }

    let folder = URL(fileURLWithPath: path)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

    for (name, json) in Self.cases {
      let visual = try Self.visual(json)

      for width in [320.0, 360.0, 390.0] {
        for (text, size) in [("default", DynamicTypeSize.large), ("largest", .accessibility5)] {
          for dark in [false, true] {
            let file = "ios-\(name)-\(Int(width))-\(dark ? "dark" : "light")-\(text).png"
            try await write(
              visual, width: width, size: size, dark: dark, to: folder.appending(path: file))
          }
        }
      }
    }
  }

  private func write(
    _ visual: LessonVisual, width: Double, size: DynamicTypeSize, dark: Bool, to file: URL
  ) async throws {
    let window = try show(
      VStack {
        LessonVisualView(visual: visual)
          .padding(16)
          .environment(\.dynamicTypeSize, size)
        Spacer(minLength: 0)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(.background))
    window.overrideUserInterfaceStyle = dark ? .dark : .light
    window.frame = CGRect(x: 0, y: 0, width: width, height: 1100)
    try await Task.sleep(for: .milliseconds(400))

    let format = UIGraphicsImageRendererFormat()
    format.scale = 3
    let image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { _ in
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
    }
    try XCTUnwrap(image.pngData()).write(to: file)
    window.isHidden = true
  }

  private static func visual(_ json: String) throws -> LessonVisual {
    try JSONDecoder().decode(LessonVisual.self, from: Data(json.utf8))
  }

  private static func plot(
    title: String, x: String, xUnit: String?, y: String, yUnit: String?, mark: String,
    points: [(Double, Double, String?)], references: [(String, Double)] = []
  ) -> String {
    let encode = { (text: String?) in text.map { "\"\($0)\"" } ?? "null" }
    let shown = points.map { "{\"x\": \($0.0), \"y\": \($0.1), \"label\": \(encode($0.2))}" }
    let lines = references.map { "{\"label\": \"\($0.0)\", \"y\": \($0.1)}" }

    return """
      {"kind": "plot", "title": "\(title)", "xLabel": "\(x)", "xUnit": \(encode(xUnit)),
       "yLabel": "\(y)", "yUnit": \(encode(yUnit)), "source": null,
       "series": [{"name": "\(y)", "mark": "\(mark)", "points": [\(shown.joined(separator: ","))]}],
       "references": [\(lines.joined(separator: ","))]}
      """
  }

  private static func chart(
    title: String, category: String, categories: [String], value: String, unit: String?,
    values: [Double], kind: String = "bar", axisStart: Double? = nil
  ) -> String {
    let quote = { (text: String) in "\"\(text)\"" }

    return """
      {"kind": "chart", "chart": "\(kind)", "title": "\(title)", "categoryLabel": "\(category)",
       "valueLabel": "\(value)", "unit": \(unit.map(quote) ?? "null"),
       "axisStart": \(axisStart.map { "\($0)" } ?? "null"),
       "categories": [\(categories.map(quote).joined(separator: ","))],
       "series": [{"name": "\(value)", "values": \(values)}], "source": null}
      """
  }

  private static let weights = [499.8, 500.6, 499.3, 501, 500.4, 501.6, 502.3, 503.8, 502.9, 502.1]

  private static let control = plot(
    title: "Bottle fill weight, last 10 days", x: "Day", xUnit: nil, y: "Fill weight",
    yUnit: "ml", mark: "lineWithPoints",
    points: weights.enumerated().map { (Double($0.offset + 1), $0.element, nil) },
    references: [("Upper limit", 503), ("Target", 500), ("Lower limit", 497)])

  private static let cases: [(String, String)] = [
    ("plot-control", control),
    (
      "plot-fine-scan",
      plot(
        title: "Finer scan, B to D", x: "Detector position", xUnit: "mm", y: "Count rate",
        yUnit: "counts/s", mark: "lineWithPoints",
        points: [
          (1.5, 880, nil), (2, 930, nil), (2.25, 968, nil), (2.5, 992, nil), (2.75, 975, nil),
          (3, 952, nil), (3.25, 925, nil), (3.5, 905, nil), (4, 893, nil), (4.5, 890, nil),
        ],
        references: [("Needed tonight", 960)])
    ),
    (
      "plot-german",
      plot(
        title: "Temperatur im Kühlraum", x: "Tag", xUnit: nil, y: "Temperatur", yUnit: "°C",
        mark: "lineWithPoints",
        points: [3.1, 3.4, 3, 3.8, 4.2, 4.6, 4.1].enumerated().map {
          (Double($0.offset + 1), $0.element, nil)
        },
        references: [("Temperaturgrenze", 4.5)])
    ),
    (
      "plot-close-lines",
      plot(
        title: "Bottle fill weight, last 10 days", x: "Day", xUnit: nil, y: "Fill weight",
        yUnit: "ml", mark: "lineWithPoints",
        points: weights.enumerated().map { (Double($0.offset + 1), $0.element, nil) },
        references: [("Upper limit", 501), ("Upper warning limit", 500.6), ("Target", 500)])
    ),
    (
      "plot-single-point",
      plot(
        title: "Detector scan", x: "Detector position", xUnit: "mm", y: "Count rate",
        yUnit: "counts/s", mark: "points", points: [(3, 952, "Peak")])
    ),
    (
      "plot-ten-thousand",
      plot(
        title: "Visitors by price", x: "Price", xUnit: nil, y: "Visitors", yUnit: nil,
        mark: "lineWithPoints", points: [10_000, 10_150, 10_400].map { ($0, $0, nil) })
    ),
    (
      "plot-months",
      plot(
        title: "Average temperature by month", x: "Month", xUnit: nil, y: "Temperature",
        yUnit: "°C", mark: "line",
        points: [27.6, 27.7, 27.5, 27, 26.2, 25.4, 24.9, 25, 25.6, 26.4, 26.9, 27.3].enumerated()
          .map { (Double($0.offset + 1), $0.element, nil) })
    ),
    (
      "plot-named-countries",
      plot(
        title: "Spending on health and life expectancy, 2021", x: "Health spending per person",
        xUnit: "US$", y: "Life expectancy", yUnit: "years", mark: "points",
        points: [
          (12_318, 76.4, "United States"), (8_011, 82.9, "Switzerland"), (6_166, 80.8, "Germany"),
          (4_666, 84.5, "Japan"), (1_514, 72.8, "Brazil"), (1_265, 74.4, "Mexico"),
          (57, 67.2, "India"),
        ])
    ),
    (
      "chart-unit-km",
      chart(
        title: "Distance run this week", category: "Runner", categories: ["Ana", "Bruno", "Carla"],
        value: "Distance", unit: "km", values: [35, 42, 28])
    ),
    (
      "chart-unit-long",
      chart(
        title: "Time to sort mail", category: "Desk", categories: ["Desk A", "Desk B", "Desk C"],
        value: "Sorting time", unit: "hours per 1,000 letters", values: [3.5, 2.8, 4.1])
    ),
    (
      "chart-money-brl",
      chart(
        title: "Hourly pay", category: "Month", categories: ["Jan", "Feb", "Mar"], value: "Pay",
        unit: "R$ per hour", values: [12.5, 14, 15.75])
    ),
    (
      "chart-money-usd",
      chart(
        title: "Monthly price by plan", category: "Plan", categories: ["Basic", "Plus", "Team"],
        value: "Price", unit: "USD", values: [4.99, 9.99, 24])
    ),
    (
      "chart-cropped-line",
      chart(
        title: "Visitors per day", category: "Day", categories: ["Mon", "Tue", "Wed"],
        value: "Visitors", unit: "visits", values: [10_050, 10_200, 10_380], kind: "line",
        axisStart: 10_000)
    ),
  ]
}
