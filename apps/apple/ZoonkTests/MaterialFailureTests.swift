import SwiftUI
import XCTest

@testable import Zoonk

/// An upload's or a material question's monthly cap is the shared notice, so it follows its day
/// while the screen is open; a day's cap or any other failure stays one line.
@MainActor
final class MaterialFailureTests: XCTestCase {
  private let line = LocalizedStringResource(stringLiteral: "line")

  func testAMonthlyCapIsTheNotice() {
    let monthly = OnboardingLimit(
      period: "rolling30Days", resource: "upload", tier: "free",
      availableAt: "2026-12-20T12:00:00.000Z")
    let daily = OnboardingLimit(period: "day", resource: "upload", tier: "free")

    XCTAssertEqual(
      MaterialFailure(OnboardingError.limit(monthly)) { _ in self.line },
      .notice(monthly.help))
    XCTAssertEqual(MaterialFailure(OnboardingError.limit(daily)) { _ in self.line }, .line(line))
    XCTAssertEqual(MaterialFailure(OnboardingError.slowDown) { _ in self.line }, .line(line))
  }

  /// With the screen open at the instant, the title and Subscribe go and "You can try again now."
  /// stays: fewer rows are inked after it than before.
  func testTheNoticeFollowsItsDayWithTheScreenOpen() async throws {
    for kind in [HelpLimit.Kind.uploads, .questions] {
      let limit = HelpLimit.usedUp(tier: .free, availableAt: .now.addingTimeInterval(1.5))
      let window = try show(
        MaterialFailureView(failure: .notice(limit), kind: kind)
          .frame(width: 320)
          .environment(AppRouter()))

      try await Task.sleep(for: .seconds(0.5))
      let before = inkedRows(window)
      try await Task.sleep(for: .seconds(2))
      let after = inkedRows(window)

      XCTAssertGreaterThan(before, 0, "The render is blank or misread")
      XCTAssertLessThan(after, before, "\(kind): the notice didn't change at its day")
      window.isHidden = true
    }
  }

  private func inkedRows(_ window: UIWindow) -> Int {
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
      return 0
    }

    let pixelBytes = cgImage.bitsPerPixel / 8

    return (0..<cgImage.height).count { y in
      (0..<cgImage.width).contains { x in
        let pixel = y * cgImage.bytesPerRow + x * pixelBytes
        return Int(bytes[pixel]) + Int(bytes[pixel + 1]) + Int(bytes[pixel + 2]) < 600
      }
    }
  }
}
