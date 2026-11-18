import SwiftUI
import XCTest

@testable import Zoonk

/// The certificate page's actions share a row only where every label fits whole.
@MainActor
final class CertificateActionsTests: XCTestCase {
  func testAPhoneStacksTheActionsInsteadOfBreakingTheirLabels() async throws {
    let frames = try await actionFrames(width: 393)
    let share = try XCTUnwrap(frames["Share"])

    for (label, frame) in frames {
      XCTAssertEqual(frame.height, share.height, accuracy: 1, "\(label) breaks over lines")
    }

    XCTAssertGreaterThan(
      try XCTUnwrap(frames["Print"]).minY, share.maxY, "Share sits over the rest")
  }

  func testAnIPadKeepsTheActionsInOneRow() async throws {
    let frames = try await actionFrames(width: 1024)
    let share = try XCTUnwrap(frames["Share"])

    for (label, frame) in frames {
      XCTAssertEqual(frame.minY, share.minY, accuracy: 1, "\(label) leaves the row")
      XCTAssertEqual(frame.height, share.height, accuracy: 1, "\(label) breaks over lines")
    }
  }

  private func actionFrames(width: CGFloat) async throws -> [String: CGRect] {
    try readsWhatVoiceOverReads()
    let window = try show(
      ZoonkList {
        Section {
          CertificateActions {
            Button {
            } label: {
              Label("Share", systemImage: "square.and.arrow.up")
            }
          } others: {
            Button {
            } label: {
              Label("Print", systemImage: "printer")
            }
            Button {
            } label: {
              Label("Save certificate", systemImage: "square.and.arrow.down")
            }
            Button {
            } label: {
              Label("Add to LinkedIn", systemImage: "arrow.up.right")
            }
          }
        }
      }
      .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: width, height: 852)
    try await waitForLayout(in: window)

    let labels: Set = ["Share", "Print", "Save certificate", "Add to LinkedIn"]
    let frames = Dictionary(
      accessibilityElements(in: window).compactMap { element in
        element.accessibilityLabel.flatMap {
          labels.contains($0) ? ($0, element.accessibilityFrame) : nil
        }
      },
      uniquingKeysWith: { first, _ in first })
    XCTAssertEqual(Set(frames.keys), labels, "Every action shows")

    return frames
  }
}
