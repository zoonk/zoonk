import GameController
import SwiftUI
import UIKit

/// The big pad the learner taps. A tap counts the moment the finger or key goes down (not on
/// release), timed by the touch's or key press's own timestamp, the host clock the clicks are
/// scheduled on. Space taps too, from a hardware keyboard. VoiceOver users tap it directly
/// (`allowsDirectInteraction`), since a double tap can't keep time.
struct RhythmTapPad: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var isPressed = false

  let isActive: Bool
  let isCountingIn: Bool
  let onTap: (TimeInterval) -> Void

  var body: some View {
    VStack(spacing: 4) {
      Image(systemName: "hand.tap")
        .font(.title)
      title
        .font(.headline)

      if GCKeyboard.coalesced != nil {
        Text(
          "or press Space", tableName: "ActivitiesMusic",
          comment: "Under the rhythm pad, with a hardware keyboard"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }
    }
    .frame(maxWidth: .infinity, minHeight: 128)
    .padding()
    .accessibilityHidden(true)
    .background(Color(.tertiarySystemFill), in: .rect(cornerRadius: 20, style: .continuous))
    .opacity(isActive ? 1 : 0.6)
    .scaleEffect(isPressed && !reduceMotion ? 0.98 : 1)
    .animation(.snappy(duration: 0.1), value: isPressed)
    .overlay {
      RhythmTapSurface(isActive: isActive, label: label) { time in
        onTap(time)
      } onPressChange: { pressed in
        isPressed = pressed
      }
    }
    .sensoryFeedback(.impact(weight: .light), trigger: isPressed) { _, pressed in
      pressed && isActive
    }
  }

  private var title: Text {
    isCountingIn
      ? Text(
        "Get ready…", tableName: "ActivitiesMusic",
        comment: "On the rhythm pad while a bar is counted in")
      : Text("Tap here", tableName: "ActivitiesMusic", comment: "On the rhythm pad")
  }

  private var label: String {
    isCountingIn
      ? String(
        localized: "Get ready…", table: "ActivitiesMusic",
        comment: "On the rhythm pad while a bar is counted in")
      : String(localized: "Tap here", table: "ActivitiesMusic", comment: "On the rhythm pad")
  }
}

/// A transparent UIKit view over the pad: SwiftUI's gestures don't carry the touch's time.
private struct RhythmTapSurface: UIViewRepresentable {
  let isActive: Bool
  let label: String
  let onTap: (TimeInterval) -> Void
  let onPressChange: (Bool) -> Void

  func makeUIView(context: Context) -> TapSurfaceView {
    TapSurfaceView()
  }

  func updateUIView(_ view: TapSurfaceView, context: Context) {
    view.isActive = isActive
    view.onTap = onTap
    view.onPressChange = onPressChange
    view.accessibilityLabel = label
    view.accessibilityTraits =
      isActive ? [.allowsDirectInteraction, .button] : [.button, .notEnabled]

    if isActive, view.window != nil, !view.isFirstResponder {
      view.becomeFirstResponder()
    } else if !isActive, view.isFirstResponder {
      view.resignFirstResponder()
    }
  }

  final class TapSurfaceView: UIView {
    var isActive = false
    var onTap: ((TimeInterval) -> Void)?
    var onPressChange: ((Bool) -> Void)?

    override init(frame: CGRect) {
      super.init(frame: frame)
      backgroundColor = .clear
      isMultipleTouchEnabled = true
      isAccessibilityElement = true
    }

    required init?(coder: NSCoder) {
      nil
    }

    override var canBecomeFirstResponder: Bool { true }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
      guard isActive else {
        return
      }

      for touch in touches {
        onTap?(touch.timestamp)
      }

      onPressChange?(true)
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
      onPressChange?(false)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
      onPressChange?(false)
    }

    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
      let spaces = presses.filter { $0.key?.keyCode == .keyboardSpacebar }

      guard isActive, !spaces.isEmpty else {
        super.pressesBegan(presses, with: event)
        return
      }

      for press in spaces {
        onTap?(press.timestamp)
      }

      onPressChange?(true)
    }

    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
      onPressChange?(false)
      super.pressesEnded(presses, with: event)
    }

    /// VoiceOver's double tap, when direct interaction is off: it counts when it lands.
    override func accessibilityActivate() -> Bool {
      guard isActive else {
        return false
      }

      onTap?(ProcessInfo.processInfo.systemUptime)
      return true
    }
  }
}
