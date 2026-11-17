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

  @MainActor
  func requestViews<Kind: UIView>(_ kind: Kind.Type, in root: UIView) -> [Kind] {
    ((root as? Kind).map { [$0] } ?? []) + root.subviews.flatMap { requestViews(kind, in: $0) }
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

extension TestContinuation where Value == Void {
  nonisolated func resume() { resume(returning: ()) }
}

func withTestContinuation<Value: Sendable>(
  timeout: Duration = .seconds(10),
  isolation: isolated (any Actor)? = #isolation,
  file: StaticString = #filePath, line: UInt = #line,
  _ register: (TestContinuation<Value>) -> Void
) async throws -> Value {
  let continuation = TestContinuation<Value>()
  register(continuation)
  // Held responses model a sent request that still answers after its caller is canceled.
  let response = Task { @MainActor in
    try await waitForTestCondition(
      "Fixture continuation was never resumed", timeout: timeout, file: file, line: line
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
  func testAFailedFirstActivationIsNotRetried() async throws {
    let window = try show(Color.clear)
    let button = RefusesFirstActivation(frame: CGRect(x: 20, y: 100, width: 100, height: 50))
    button.accessibilityLabel = "Fails first activation"
    button.isAccessibilityElement = true
    window.addSubview(button)
    let options = XCTExpectedFailure.Options()
    options.issueMatcher = { $0.compactDescription.contains("didn't act") }
    XCTExpectFailure("A failed activation must fail the test", options: options)
    do {
      try await activate("Fails first activation", in: window)
    } catch {}
    XCTAssertEqual(button.activations, 1)
  }

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

  func testAnUnresumedFixtureFailsAndThrowsAtItsDeadline() async {
    let options = XCTExpectedFailure.Options()
    options.issueMatcher = {
      $0.compactDescription.contains("Fixture continuation was never resumed")
    }
    XCTExpectFailure("Missing fixture responses must fail without hanging", options: options)
    do {
      let _: Void = try await withTestContinuation(timeout: .milliseconds(1)) { _ in }
      XCTFail("The missing response must throw")
    } catch {}
  }
}

@MainActor
private final class RefusesFirstActivation: UIButton {
  private(set) var activations = 0

  override func accessibilityActivate() -> Bool {
    activations += 1
    return activations > 1
  }
}
