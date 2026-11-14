import SwiftUI
import XCTest

extension XCTestCase {
  /// Shows a view in a real window on the app's scene, taken down when the test ends.
  @MainActor
  func show(_ view: some View) throws {
    let scene = try XCTUnwrap(
      UIApplication.shared.connectedScenes.first { $0 is UIWindowScene } as? UIWindowScene)
    let window = UIWindow(windowScene: scene)
    window.rootViewController = UIHostingController(rootView: view)
    window.makeKeyAndVisible()
    addTeardownBlock { window.isHidden = true }
  }
}
