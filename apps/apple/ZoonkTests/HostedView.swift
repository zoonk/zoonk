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
