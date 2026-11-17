import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class SQLDisclosureTests: XCTestCase {
  func testTableReportsItsExpandedAndCollapsedStateToVoiceOver() async throws {
    try readsWhatVoiceOverReads()
    let payload = try JSONDecoder().decode(
      JSONValue.self,
      from: Data(
        #"{"fields":{"expected":{"columns":["name"],"orderMatters":true,"rows":[["India"]]},"mistakes":[],"solution":"SELECT name FROM countries","tables":[{"columns":[{"name":"name","type":"text"}],"name":"countries","rows":[["India"]]}]}}"#
          .utf8))
    let window = try show(
      ActivityRenderer.sqlPlayground.canvas(
        ActivityCanvasContext(
          template: "sqlPlayground", payload: payload, check: nil, phase: .answering,
          answer: nil, setAnswer: { _ in })
      ).environment(ActivityWork()))
    try await Task.sleep(for: .milliseconds(600))
    let expanded = try XCTUnwrap(header(in: window))
    XCTAssertEqual(
      expanded.accessibilityExpandedStatus, .expanded,
      "AX label: \(expanded.accessibilityLabel ?? "nil"), hint: \(expanded.accessibilityHint ?? "nil"), traits: \(expanded.accessibilityTraits.rawValue)"
    )
    XCTAssertTrue(expanded.accessibilityActivate())
    try await Task.sleep(for: .milliseconds(300))
    let collapsed = try XCTUnwrap(header(in: window))
    XCTAssertEqual(collapsed.accessibilityExpandedStatus, .collapsed)
    XCTAssertTrue(collapsed.accessibilityActivate())
    try await Task.sleep(for: .milliseconds(300))
    XCTAssertEqual(header(in: window)?.accessibilityExpandedStatus, .expanded)
  }

  private func header(in element: NSObject) -> NSObject? {
    if element.accessibilityLabel?.contains("countries") == true,
      element.accessibilityExpandedStatus != .unsupported
    {
      return element
    }
    let children = (element as? UIView)?.subviews.map { $0 as NSObject } ?? []
    let accessible = element.accessibilityElements?.compactMap { $0 as? NSObject } ?? []
    return (children + accessible).lazy.compactMap { self.header(in: $0) }.first
  }

}
