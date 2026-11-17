import SwiftUI
import Vision
import XCTest

@testable import Zoonk

@MainActor
final class FactsLayoutTests: XCTestCase {
  func testFlowReportsItsFirstTextBaseline() async throws {
    let probes = FactProbes()
    let window = try show(
      HStack(alignment: .firstTextBaseline) {
        Text(verbatim: "Course outline").background(FactProbe(id: "heading", probes: probes))
        FactSegments(["9 chapters", "24 lessons"])
          .frame(width: 85, alignment: .leading)
          .background(FactProbe(id: "fact", probes: probes))
      }.font(.system(size: 17)).frame(width: 340)
    )
    try await settle(window)
    XCTAssertEqual(
      try top("heading", probes, window), try top("fact", probes, window), accuracy: 0.5)
  }

  func testFittingFactStaysOnOneLine() async throws {
    let probes = FactProbes()
    let window = try show(
      VStack {
        Text(verbatim: "X").background(FactProbe(id: "reference", probes: probes))
        FactSegments(["14 Nov 2027"])
          .background(FactProbe(id: "fact", probes: probes))
      }.font(.system(size: 17)).frame(width: 140)
    )
    try await settle(window)
    let reference = try XCTUnwrap(probes.views["reference"])
    let fact = try XCTUnwrap(probes.views["fact"])
    XCTAssertEqual(fact.bounds.height, reference.bounds.height, accuracy: 0.5)
  }

  func testLongFactWrapsWithinItsFrame() async throws {
    try await assertWrappingFact(
      .init(text: "Sunday, 14 November 2027"), width: 140)
  }

  func testCompactFactWrapsWhenNeitherFormFits() async throws {
    try await assertWrappingFact(
      .init(text: "Sunday, 14 November 2027", compact: "14 Nov 2027"), width: 60)
  }

  private func assertWrappingFact(_ value: FactSegments.Fact, width: CGFloat) async throws {
    let probes = FactProbes()
    let window = try show(
      VStack {
        Text(verbatim: "X").background(FactProbe(id: "reference", probes: probes))
        FactSegments(facts: [value]).background(FactProbe(id: "fact", probes: probes))
      }.font(.system(size: 17)).frame(width: width)
    )
    try await settle(window)
    let reference = try XCTUnwrap(probes.views["reference"])
    let fact = try XCTUnwrap(probes.views["fact"])
    XCTAssertGreaterThan(fact.bounds.height, reference.bounds.height + 0.5)
    XCTAssertLessThanOrEqual(fact.bounds.width, width)
  }

  func testWideDateUsesItsCompactForm() async throws {
    let window = try show(
      FactSegments(facts: [
        .init(text: "Sunday, 14 November 2027", compact: "14 Nov 2027")
      ]).font(.system(size: 17)).frame(width: 140)
    )
    try await settle(window)
    let image = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
    }
    let request = VNRecognizeTextRequest()
    try VNImageRequestHandler(cgImage: try XCTUnwrap(image.cgImage)).perform([request])
    let words = (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(
      separator: " ")
    XCTAssertTrue(words.contains("14 Nov 2027"), words)
    XCTAssertFalse(words.contains("Sunday"), words)
  }

  func testRowFactsRemainReadableAndActionableToVoiceOver() async throws {
    try readsWhatVoiceOverReads()
    var opens = 0
    let window = try show(
      Button {
        opens += 1
      } label: {
        ListRow(Text(verbatim: "Focus test"), descriptionFacts: ["12 questions", "5 min"])
      }
    )
    try await settle(window)
    let labels = spoken(in: window).map { $0.replacing("\u{00A0}", with: " ") }
    XCTAssertTrue(
      labels.contains { $0.contains("12 questions") && $0.contains("5 min") }, "\(labels)")
    try activate(where: { $0.contains("Focus test") }, in: window)
    XCTAssertEqual(opens, 1)
  }

  private func top(_ id: String, _ probes: FactProbes, _ window: UIWindow) throws -> CGFloat {
    let view = try XCTUnwrap(probes.views[id])
    return view.convert(view.bounds, to: window).minY
  }

  private func settle(_ window: UIWindow) async throws {
    for _ in 0..<10 {
      window.layoutIfNeeded()
      try await Task.sleep(for: .milliseconds(50))
    }
  }
}

@MainActor
private final class FactProbes {
  var views: [String: UIView] = [:]
}

private struct FactProbe: UIViewRepresentable {
  let id: String
  let probes: FactProbes
  func makeUIView(context: Context) -> UIView {
    let view = UIView()
    probes.views[id] = view
    return view
  }
  func updateUIView(_ view: UIView, context: Context) {}
}
