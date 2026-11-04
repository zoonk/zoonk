import SwiftUI

enum AnswerOptionResult: Equatable {
  case right
  case wrong
}

/// The first nine answer to their number key on a hardware keyboard, as on the web.
struct AnswerOption<Label: View>: View {
  var marker: Int?
  var isPicked = false
  var result: AnswerOptionResult?
  var isLocked = false
  var tag: AnyView?
  let action: () -> Void
  @ViewBuilder let label: () -> Label

  var body: some View {
    Button(action: action) {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        if let marker {
          Text(marker, format: .number)
            .font(.footnote.monospacedDigit())
            .foregroundStyle(.mutedForeground)
            .accessibilityHidden(true)
        }

        AccessibilityStack(alignment: .firstTextBaseline, spacing: 12) {
          label()
            .frame(maxWidth: .infinity, alignment: .leading)
            .multilineTextAlignment(.leading)

          if let tag {
            tag
          }

          if let result {
            Text(resultLabel(result))
              .font(.caption.weight(.semibold))
              .foregroundStyle(result == .right ? Color.successText : Color.destructiveText)
          }
        }
      }
    }
    .buttonStyle(AnswerOptionStyle(isPicked: isPicked, result: result))
    .disabled(isLocked)
    .modifier(NumberKeyShortcut(number: marker, isEnabled: !isLocked))
    .accessibilityAddTraits(isPicked ? .isSelected : [])
  }

  private func resultLabel(_ result: AnswerOptionResult) -> LocalizedStringResource {
    switch result {
    case .right:
      LocalizedStringResource(
        "Correct", table: "Practice",
        comment: "Mark beside the right option once a question is graded.")
    case .wrong:
      LocalizedStringResource(
        "Your answer", table: "Practice",
        comment: "Mark beside the learner's wrong pick once a question is graded.")
    }
  }
}

/// Disabled options keep their colors, so a graded question stays readable.
struct AnswerOptionStyle: ButtonStyle {
  var isPicked: Bool
  var result: AnswerOptionResult?

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.body.weight(.medium))
      .foregroundStyle(Color(.foreground))
      .padding(.horizontal, 14)
      .padding(.vertical, 12)
      .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
      .answerSurface(tone, isPressed: configuration.isPressed)
  }

  private var tone: AnswerTone {
    switch result {
    case .right: .right
    case .wrong: .wrong
    case nil: isPicked ? .picked : .idle
    }
  }
}

private struct NumberKeyShortcut: ViewModifier {
  let number: Int?
  let isEnabled: Bool

  func body(content: Content) -> some View {
    if let number, isEnabled, (1...9).contains(number), let key = String(number).first {
      content.keyboardShortcut(KeyEquivalent(key), modifiers: [])
    } else {
      content
    }
  }
}
