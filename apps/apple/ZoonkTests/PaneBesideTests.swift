import SwiftUI
import XCTest

@testable import Zoonk

/// Zu's conversation is `PaneBeside`'s content: as its day's pane comes and goes, the conversation
/// stays the same view, so what it's asking, opening or showing in a sheet goes on.
@MainActor
final class PaneBesideTests: XCTestCase {
  func testTheContentStaysTheSameViewAsThePaneGoes() async throws {
    try await keepsContent(from: 1376, to: 420)
  }

  func testTheContentStaysTheSameViewAsThePaneComes() async throws {
    try await keepsContent(from: 420, to: 1376)
  }

  private func keepsContent(from: CGFloat, to: CGFloat) async throws {
    var appeared: [UUID] = []
    var beside: [Bool] = []
    let window = try show(
      PaneBeside(paneEdge: .trailing, primaryShare: 0.55) {
        Color.clear
      } content: { isBeside in
        Identity { appeared.append($0) }
          .onAppear { beside.append(isBeside) }
          .onChange(of: isBeside) { beside.append(isBeside) }
      })
    window.frame = CGRect(x: 0, y: 0, width: from, height: 1032)
    try await Task.sleep(for: .milliseconds(300))

    window.frame = CGRect(x: 0, y: 0, width: to, height: 1032)
    try await Task.sleep(for: .milliseconds(300))

    XCTAssertEqual(Set(appeared).count, 1, "One view throughout")
    XCTAssertEqual(beside.last, to > from, "The pane did come or go: \(beside)")
  }
}

private struct Identity: View {
  @State private var id = UUID()
  let report: (UUID) -> Void

  var body: some View {
    Color.clear.onAppear { report(id) }
  }
}
