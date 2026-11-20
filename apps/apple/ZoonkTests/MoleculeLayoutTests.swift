import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class MoleculeLayoutTests: XCTestCase {
  func testCheckingKeepsTheDrawingFrame() async throws {
    try await readsWhatVoiceOverReads()
    let phase = Phase()
    let window = try show(
      Canvas(phase: phase)
        .environment(ActivityWork())
        .frame(maxHeight: .infinity, alignment: .top))
    window.frame = CGRect(x: 0, y: 0, width: 375, height: 1000)
    try await Task.sleep(for: .milliseconds(500))
    let before = try XCTUnwrap(drawing(in: window)?.accessibilityFrame)
    XCTAssertGreaterThan(before.height, 100)
    phase.value = .checked(isCorrect: true)
    try await Task.sleep(for: .milliseconds(500))
    XCTAssertEqual(try XCTUnwrap(drawing(in: window)?.accessibilityFrame), before)
    XCTAssertFalse(spoken(in: window).contains { $0.hasPrefix("Add Carbon") })
  }

  func testKeyboardHeadingNamesTheStartingChord() async throws {
    try await readsWhatVoiceOverReads()
    let payload = try JSONDecoder().decode(
      JSONValue.self,
      from: Data(
        #"{"fields":{"instruments":["piano"],"start":{"kind":"chord","quality":"major","root":"C"},"target":{"kind":"chord","quality":"minor","root":"C"}}}"#
          .utf8))
    let window = try show(
      ActivityRenderer.keyboardFretboard.canvas(
        ActivityCanvasContext(
          template: "keyboardFretboard", payload: payload, check: nil, phase: .answering,
          answer: nil, setAnswer: { _ in })
      )
      .environment(ActivityWork()))
    try await Task.sleep(for: .milliseconds(500))
    XCTAssertTrue(spoken(in: window).contains("C major"), "\(spoken(in: window))")
    XCTAssertFalse(spoken(in: window).contains("C minor"))
  }

  private func drawing(in element: NSObject) -> NSObject? {
    if element.responds(to: NSSelectorFromString("accessibilityIdentifier")),
      element.value(forKey: "accessibilityIdentifier") as? String == "molecule-drawing"
    {
      return element
    }
    let children = (element as? UIView)?.subviews.map { $0 as NSObject } ?? []
    let accessible = element.accessibilityElements?.compactMap { $0 as? NSObject } ?? []
    return (children + accessible).lazy.compactMap { self.drawing(in: $0) }.first
  }
}

@MainActor
@Observable
private final class Phase {
  var value: ActivityPhase = .answering
}

private struct Canvas: View {
  let phase: Phase

  var body: some View {
    MoleculeBuilderCanvas(
      context: ActivityCanvasContext(
        template: "moleculeBuilder", payload: .null, check: nil, phase: phase.value,
        answer: try? ActivityAnswer(
          encoding: MoleculeBuild(
            atoms: [.init(element: "C", id: "a1")])), setAnswer: { _ in }),
      fields: MoleculeBuilderFields(elements: ["C", "O", "H"], formula: "CO2"))
  }
}
