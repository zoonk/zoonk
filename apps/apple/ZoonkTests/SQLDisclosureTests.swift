import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class SQLDisclosureTests: XCTestCase {
  func testTableReportsItsExpandedAndCollapsedStateToVoiceOver() async throws {
    try await readsWhatVoiceOverReads()
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
    XCTAssertEqual(headerStops(in: window, header: expanded), ["countries, 1 row"])
    XCTAssertEqual(
      expanded.accessibilityExpandedStatus, .expanded,
      "AX label: \(expanded.accessibilityLabel ?? "nil"), hint: \(expanded.accessibilityHint ?? "nil"), traits: \(expanded.accessibilityTraits.rawValue)"
    )
    XCTAssertTrue(expanded.accessibilityActivate())
    try await Task.sleep(for: .milliseconds(300))
    let collapsed = try XCTUnwrap(header(in: window))
    XCTAssertEqual(headerStops(in: window, header: collapsed), ["countries, 1 row"])
    XCTAssertEqual(collapsed.accessibilityExpandedStatus, .collapsed)
    XCTAssertTrue(collapsed.accessibilityActivate())
    try await Task.sleep(for: .milliseconds(300))
    XCTAssertEqual(header(in: window)?.accessibilityExpandedStatus, .expanded)
  }

  private func headerStops(in window: UIWindow, header: NSObject) -> [String] {
    XCTAssertGreaterThan(header.accessibilityFrame.width, 0)
    var seen = Set<ObjectIdentifier>()
    func stops(_ element: NSObject) -> [NSObject] {
      guard seen.insert(ObjectIdentifier(element)).inserted else { return [] }
      if element.isAccessibilityElement { return [element] }
      if let accessible = element.accessibilityElements {
        return accessible.compactMap { $0 as? NSObject }.flatMap(stops)
      }
      return ((element as? UIView)?.subviews ?? []).flatMap { stops($0) }
    }
    let labels = stops(window).filter {
      header.accessibilityFrame.contains(
        CGPoint(x: $0.accessibilityFrame.midX, y: $0.accessibilityFrame.midY))
    }.compactMap(\.accessibilityLabel)
    let attachment = XCTAttachment(string: labels.joined(separator: "\n"))
    attachment.lifetime = .keepAlways
    add(attachment)
    return labels
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
