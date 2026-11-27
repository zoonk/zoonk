import SwiftUI
import Synchronization
import XCTest

extension XCTestCase {
  /// Shows a view in a real window on the app's scene, taken down when the test ends.
  @MainActor @discardableResult
  func show(_ view: some View) throws -> UIWindow {
    let scene = try XCTUnwrap(
      UIApplication.shared.connectedScenes.first { $0 is UIWindowScene } as? UIWindowScene)
    let window = UIWindow(windowScene: scene)
    window.rootViewController = UIHostingController(rootView: view.background(HostedLayoutProbe()))
    window.makeKeyAndVisible()
    addTeardownBlock { window.isHidden = true }
    return window
  }

  /// SwiftUI builds what VoiceOver reads only while the simulator has app accessibility on, which
  /// a simulator an automation tool has driven keeps and a new one lacks, so a test that reads or
  /// taps the screen as VoiceOver does turns it on for itself through the system's accessibility
  /// library, as accessibility snapshot tests do. UIKit loads its accessibility bundle a moment
  /// later; until then, VoiceOver's activation of a UIKit control, such as a menu's button, does
  /// nothing, so this returns once it has loaded.
  @MainActor
  func readsWhatVoiceOverReads() async throws {
    try XCTSkipIf(
      ProcessInfo.processInfo.isMacCatalystApp,
      "Exercises native iOS layout or accessibility in the iPhone suite.")
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
    try await waitForTestCondition("UIKit's accessibility bundle didn't load") {
      Bundle.allBundles.contains {
        $0.bundleURL.lastPathComponent == "UIKit.axbundle" && $0.isLoaded
      }
    }
  }

  /// What VoiceOver can read on the screen.
  @MainActor
  func spoken(in element: Any) -> [String] {
    accessibilityElements(in: element).compactMap(\.accessibilityLabel).filter { !$0.isEmpty }
  }

  @MainActor
  func spokenValues(in element: Any) -> [String] {
    accessibilityElements(in: element).compactMap(\.accessibilityValue).filter { !$0.isEmpty }
  }

  /// Picks `label` from the open menu as a tap on its row does: the menu closes, then the item's
  /// action runs. SwiftUI fills a menu's items only once it's open, and its rows ignore a selection
  /// that isn't a touch, so the test runs the item's action itself.
  @MainActor
  func pick(_ label: String, in window: UIWindow) async throws {
    var item: (menu: UIContextMenuInteraction?, action: UIAction)?
    try await waitForTestCondition("No open menu offers \(label)") {
      item =
        requestViews(UIButton.self, in: window).lazy.compactMap { button in
          button.menu.flatMap { self.menuAction(label, in: $0) }.map {
            (button.contextMenuInteraction, $0)
          }
        }.first
      return item != nil
    }
    item?.menu?.dismissMenu()
    try await waitForTestCondition("The menu did not close") {
      !self.spoken(in: window).contains { $0.contains(label) }
    }
    item?.action.performWithSender(nil, target: nil)
  }

  @MainActor
  private func menuAction(_ title: String, in menu: UIMenu) -> UIAction? {
    for child in menu.children {
      if let action = child as? UIAction, action.title == title {
        return action
      }

      if let found = (child as? UIMenu).flatMap({ menuAction(title, in: $0) }) {
        return found
      }
    }

    return nil
  }

  /// Taps what VoiceOver reads as `label`, as a double tap with VoiceOver does.
  @MainActor
  func activate(
    _ label: String, in window: UIWindow, file: StaticString = #filePath, line: UInt = #line
  ) async throws {
    try await activate(where: { $0 == label }, in: window, file: file, line: line)
  }

  @MainActor
  func activate(
    where matches: (String) -> Bool, in window: UIWindow,
    file: StaticString = #filePath, line: UInt = #line
  ) async throws {
    var ready: NSObject?
    try await waitForTestCondition(
      "No matching control is ready: \(spoken(in: window))", file: file, line: line
    ) {
      var controller = window.rootViewController
      while let current = controller {
        if current.isBeingPresented || current.isBeingDismissed { return false }
        controller = current.presentedViewController
      }
      ready = self.accessibilityElements(in: window).first {
        guard $0.accessibilityLabel.map(matches) ?? false, $0.isAccessibilityElement,
          !$0.accessibilityTraits.contains(.notEnabled)
        else { return false }
        if let control = $0 as? UIControl { return control.isEnabled }
        return $0.isAccessibilityElement
          && ($0.accessibilityTraits.contains(.button) || $0.accessibilityTraits.contains(.link))
      }
      return ready != nil
    }
    let element = try XCTUnwrap(ready, file: file, line: line)
    guard element.accessibilityActivate() else {
      XCTFail("\(element.accessibilityLabel ?? "Control") didn't act", file: file, line: line)
      throw HostedActivationFailure()
    }
  }

  @MainActor
  func accessibilityElements(in element: Any) -> [NSObject] {
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

  @MainActor
  func requestViews<Kind: UIView>(_ kind: Kind.Type, in root: UIView) -> [Kind] {
    ((root as? Kind).map { [$0] } ?? []) + root.subviews.flatMap { requestViews(kind, in: $0) }
  }
}

extension XCTestCase {
  @MainActor
  func closeRequestSheet(
    in window: UIWindow, file: StaticString = #filePath, line: UInt = #line
  ) async throws {
    var control: UIControl?
    try await waitForTestCondition("The sheet close control did not appear", file: file, line: line)
    {
      let buttons = self.views(in: window).filter { $0.accessibilityLabel == "Close" }
      control =
        buttons.compactMap { $0 as? UIControl }.first
        ?? buttons.lazy.compactMap { self.views(in: $0).compactMap { $0 as? UIControl }.first }
        .first
      return control?.isEnabled == true
    }
    let close = try XCTUnwrap(control, file: file, line: line)
    close.sendActions(for: .touchUpInside)
    try await waitForTestCondition("The sheet did not close", file: file, line: line) {
      window.rootViewController?.presentedViewController == nil
    }
  }

  @MainActor
  private func views(in view: UIView) -> [UIView] {
    [view] + view.subviews.flatMap { views(in: $0) }
  }

}

@MainActor
@discardableResult
func waitForTestCondition(
  _ message: @autoclosure () -> String = "Expected condition did not arrive",
  timeout: Duration = .seconds(10),
  file: StaticString = #filePath, line: UInt = #line,
  _ condition: @MainActor () async throws -> Bool
) async throws -> Bool {
  let deadline = ContinuousClock.now + timeout
  while try await !condition() {
    guard ContinuousClock.now < deadline else {
      XCTFail(message(), file: file, line: line)
      throw WaitTimeout()
    }
    try await Task.sleep(for: .milliseconds(20))
  }
  return true
}

private struct WaitTimeout: Error {}
private struct HostedActivationFailure: Error {}

private struct HostedLayoutProbe: UIViewRepresentable {
  func makeUIView(context: Context) -> HostedLayoutView { HostedLayoutView() }
  func updateUIView(_ view: HostedLayoutView, context: Context) {}
}

private final class HostedLayoutView: UIView {}

extension XCTestCase {
  @MainActor
  func waitForLayout(in window: UIWindow, file: StaticString = #filePath, line: UInt = #line)
    async throws
  {
    try await waitForTestCondition(
      "Hosted view did not lay out at width \(window.bounds.width)", file: file, line: line
    ) {
      self.requestViews(HostedLayoutView.self, in: window).contains {
        $0.bounds.width == window.bounds.width && $0.bounds.height > 0
      }
    }
  }
}

final class TestContinuation<Value: Sendable>: Sendable {
  private let stored = Mutex<Result<Value, any Error>?>(nil)

  nonisolated var result: Result<Value, any Error>? { stored.withLock { $0 } }

  nonisolated func resume(returning value: Value) { resume(with: .success(value)) }
  nonisolated func resume(throwing error: any Error) { resume(with: .failure(error)) }

  nonisolated func resume(with result: Result<Value, any Error>) {
    stored.withLock { stored in
      guard case nil = stored else { preconditionFailure("Fixture resumed twice") }
      stored = result
    }
  }
}

/// Holds test work until `open()`, and fails the test instead of hanging when it never opens.
@MainActor
final class TestGate {
  private var isOpen = false

  func open() { isOpen = true }

  /// Waits even when the task waiting is canceled, as work already sent keeps going.
  func wait(file: StaticString = #filePath, line: UInt = #line) async {
    let opened = Task { @MainActor in
      try await waitForTestCondition("The gate was never opened", file: file, line: line) {
        self.isOpen
      }
    }
    _ = try? await opened.value
  }
}

extension TestContinuation where Value == Void {
  nonisolated func resume() { resume(returning: ()) }
}

func withTestContinuation<Value: Sendable>(
  isolation: isolated (any Actor)? = #isolation,
  file: StaticString = #filePath, line: UInt = #line,
  _ register: (TestContinuation<Value>) -> Void
) async throws -> Value {
  let continuation = TestContinuation<Value>()
  register(continuation)
  // Held responses model a sent request that still answers after its caller is canceled. A hold
  // spans several of the test's steps, each with its own wait, so it only guards against a hang.
  let response = Task { @MainActor in
    try await waitForTestCondition(
      "Fixture continuation was never resumed", timeout: .seconds(60), file: file, line: line
    ) { continuation.result != nil }
  }
  _ = try await response.value
  return try XCTUnwrap(continuation.result, file: file, line: line).get()
}

func withTestVoidContinuation(
  isolation: isolated (any Actor)? = #isolation,
  file: StaticString = #filePath, line: UInt = #line,
  _ register: (TestContinuation<Void>) -> Void
) async {
  _ = try? await withTestContinuation(isolation: isolation, file: file, line: line, register)
}

func withTestOptionalContinuation<Value: Sendable>(
  isolation: isolated (any Actor)? = #isolation,
  file: StaticString = #filePath, line: UInt = #line,
  _ register: (TestContinuation<Value?>) -> Void
) async -> Value? {
  try? await withTestContinuation(isolation: isolation, file: file, line: line, register)
}

@MainActor
final class HostedViewSupportTests: XCTestCase {
  func testCancellationStillWaitsForTheHeldResponse() async throws {
    var held: TestContinuation<Void>?
    var finished = false
    let request = Task {
      await withTestVoidContinuation { held = $0 }
      finished = true
    }
    try await waitForTestCondition("The fixture did not start") { held != nil }
    request.cancel()
    // Canceling a sent request must not manufacture the response the test is holding.
    let canceledResponseWindow: Duration = .milliseconds(100)
    try await Task.sleep(for: canceledResponseWindow)
    XCTAssertFalse(finished)
    held?.resume()
    await request.value
    XCTAssertTrue(finished)
  }
}
