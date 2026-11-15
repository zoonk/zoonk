import SwiftUI
import XCTest

extension XCTestCase {
  /// Shows a view in a real window on the app's scene, taken down when the test ends.
  @MainActor @discardableResult
  func show(_ view: some View) throws -> UIWindow {
    let scene = try XCTUnwrap(
      UIApplication.shared.connectedScenes.first { $0 is UIWindowScene } as? UIWindowScene)
    let window = UIWindow(windowScene: scene)
    window.rootViewController = UIHostingController(rootView: view)
    window.makeKeyAndVisible()
    addTeardownBlock { window.isHidden = true }
    return window
  }

  /// SwiftUI builds what VoiceOver reads only while the simulator has app accessibility on, which
  /// a simulator an automation tool has driven keeps and a new one lacks, so a test that reads or
  /// taps the screen as VoiceOver does turns it on for itself through the system's accessibility
  /// library, as accessibility snapshot tests do.
  func readsWhatVoiceOverReads() throws {
    typealias Enabled = @convention(c) () -> Bool
    typealias SetEnabled = @convention(c) (Bool) -> Void
    let library = try XCTUnwrap(dlopen("/usr/lib/libAccessibility.dylib", RTLD_NOW))
    let enabled = unsafeBitCast(
      try XCTUnwrap(dlsym(library, "_AXSApplicationAccessibilityEnabled")), to: Enabled.self)
    let setEnabled = unsafeBitCast(
      try XCTUnwrap(dlsym(library, "_AXSApplicationAccessibilitySetEnabled")), to: SetEnabled.self)
    let wasOn = enabled()
    setEnabled(true)
    addTeardownBlock { setEnabled(wasOn) }
  }

  /// What VoiceOver can read on the screen.
  @MainActor
  func spoken(in element: Any) -> [String] {
    accessibilityElements(in: element).compactMap(\.accessibilityLabel).filter { !$0.isEmpty }
  }

  /// Taps what VoiceOver reads as `label`, as a double tap with VoiceOver does.
  @MainActor
  func activate(_ label: String, in window: UIWindow) throws {
    let element = try XCTUnwrap(
      accessibilityElements(in: window).first { $0.accessibilityLabel == label },
      "Nothing reads \(label): \(spoken(in: window))")
    XCTAssertTrue(element.accessibilityActivate(), "\(label) didn't act")
  }

  @MainActor
  private func accessibilityElements(in element: Any) -> [NSObject] {
    guard let object = element as? NSObject else {
      return []
    }

    // A list keeps cells it took off screen, hidden, for reuse.
    if let view = object as? UIView, view.isHidden || view.alpha < 0.01 {
      return []
    }

    var found = [object]

    if let view = object as? UIView {
      found += view.subviews.flatMap { accessibilityElements(in: $0) }
    }

    if let elements = object.accessibilityElements {
      found += elements.flatMap { accessibilityElements(in: $0) }
    }

    return found
  }

  /// The first drawn row from the top of the window, in points: where a centered screen starts
  /// (its icon, or its title when it has none), for screens whose parts a test can't measure from
  /// inside. Grey ink counts, so a muted icon is found as well as black words.
  @MainActor
  func inkTop(_ window: UIWindow) -> CGFloat? {
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

    for y in 0..<Int(Double(cgImage.height) * 0.7) {
      for x in 0..<cgImage.width {
        let pixel = y * cgImage.bytesPerRow + x * pixelBytes

        if Int(bytes[pixel]) + Int(bytes[pixel + 1]) + Int(bytes[pixel + 2]) < 600 {
          return CGFloat(y)
        }
      }
    }

    return nil
  }
}
