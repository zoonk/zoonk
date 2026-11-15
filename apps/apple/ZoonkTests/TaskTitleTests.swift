import SwiftUI
import XCTest

@testable import Zoonk

/// A task's title sits on the screen's middle whatever the bar holds beside it, as the system's own
/// title does, and a long one stops short of the buttons on both sides.
@MainActor
final class TaskTitleTests: XCTestCase {
  private struct Bar: CustomStringConvertible {
    var options = false
    var action = false
    var title = "Where a price comes from"
    var width: CGFloat?
    var textSize: UIContentSizeCategory?

    var description: String {
      "options \(options), action \(action), width \(width.map { "\($0)" } ?? "phone"), "
        + "text \(textSize?.rawValue ?? "default"), \(title.count) characters"
    }
  }

  private static let bars = [
    Bar(),
    Bar(options: true),
    Bar(options: true, action: true),
    Bar(title: "Why a company's shares lose value when it issues new ones to raise money"),
    Bar(options: true, title: "Why a company's shares lose value when it issues new ones"),
    Bar(width: 1024),
    Bar(options: true, action: true, width: 1024),
    Bar(textSize: .accessibilityExtraExtraExtraLarge),
    Bar(options: true, textSize: .accessibilityExtraExtraExtraLarge),
  ]

  func testTheTitleSitsOnTheScreensMiddle() async throws {
    var misses: [String] = []
    var measured: [String] = []

    for bar in Self.bars {
      let window = try show(bar)
      try await Task.sleep(for: .seconds(0.8))

      let ink = try XCTUnwrap(titleInk(window), "No title drawn: \(bar)")
      let offset = (ink.lowerBound + ink.upperBound) / 2 - window.bounds.midX
      measured.append(
        "\(bar): ink \(ink.lowerBound)...\(ink.upperBound), screen middle \(window.bounds.midX), "
          + "offset \(offset) pt")

      if abs(offset) > 1 {
        misses.append("\(bar): \(offset) pt off")
      }

      window.isHidden = true
    }

    let report = XCTAttachment(string: measured.joined(separator: "\n"))
    report.name = "title-centers"
    report.lifetime = .keepAlways
    add(report)

    XCTAssertEqual(misses, [])
  }

  private func show(_ bar: Bar) throws -> UIWindow {
    let window = try show(
      NavigationStack {
        Color.white
          .taskTitle(Text(verbatim: bar.title))
          .taskClose {
            Button(role: .close) {
            } label: {
              Image(systemName: "xmark")
            }
          }
          .taskAction(isShown: bar.action) {
            Button {
            } label: {
              Image(systemName: "square.and.arrow.down")
            }
          }
          .taskOptions(isShown: bar.options, label: Text(verbatim: "Options")) {
            Button {
            } label: {
              Text(verbatim: "Skip")
            }
          }
      })

    if let width = bar.width {
      window.frame = CGRect(x: 0, y: 0, width: width, height: 1366)
      window.traitOverrides.horizontalSizeClass = .regular
    }

    if let textSize = bar.textSize {
      window.traitOverrides.preferredContentSizeCategory = textSize
    }

    return window
  }

  /// The title's ink across the bar, in points: the widest run of dark columns in the bar's rows,
  /// which the close's and the options' glyphs are too narrow to be.
  private func titleInk(_ window: UIWindow) -> ClosedRange<CGFloat>? {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.preferredRange = .standard

    let image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { context in
      UIColor.white.setFill()
      context.fill(window.bounds)
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
    }

    guard let cgImage = image.cgImage, let data = cgImage.dataProvider?.data,
      let bytes = CFDataGetBytePtr(data)
    else {
      return nil
    }

    let pixelBytes = cgImage.bitsPerPixel / 8
    let barBottom = min(cgImage.height, Int(window.safeAreaInsets.top) + 120)
    let dark = (0..<cgImage.width).map { x in
      (0..<barBottom).contains { y in
        let pixel = y * cgImage.bytesPerRow + x * pixelBytes
        return Int(bytes[pixel]) + Int(bytes[pixel + 1]) + Int(bytes[pixel + 2]) < 300
      }
    }

    // Runs of dark columns, joined across the gaps between a title's letters and words.
    var runs: [ClosedRange<Int>] = []

    for x in dark.indices where dark[x] {
      if let last = runs.last, x - last.upperBound <= 12 {
        runs[runs.count - 1] = last.lowerBound...x
      } else {
        runs.append(x...x)
      }
    }

    return runs.max { $0.count < $1.count }.map { CGFloat($0.lowerBound)...CGFloat($0.upperBound) }
  }
}
