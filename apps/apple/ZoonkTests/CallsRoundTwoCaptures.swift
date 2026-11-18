import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
func captureCallsRoundTwo(_ name: String) throws {
  guard let path = ProcessInfo.processInfo.environment["ZOONK_CALLS_CAPTURE"] else { return }
  XCTAssertTrue(LayoutCapture.isOn, "Capture runner must pass -ZOONK_LAYOUT_CAPTURE 1")
  let folder = URL(fileURLWithPath: path, isDirectory: true)
  try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
  let capture = LayoutCaptureWriter.capture(
    scenario: name, screen: name, picture: folder.appending(path: "\(name).png"))
  let data = try JSONSerialization.data(
    withJSONObject: capture, options: [.sortedKeys, .prettyPrinted])
  try data.write(to: folder.appending(path: "\(name).json"))
  print("CALLS_CAPTURE \(name) layout=\(LayoutCapture.isOn)")
}
