import SwiftUI

/// An answer's mark once graded: the right one in soft blue, the learner's wrong pick in soft pink.
enum AnswerOptionResult: Equatable {
  case right
  case wrong
}

/// One answer option, as every practice question draws it: its words on a rounded card with a
/// hairline, a firm outline while picked, and once graded "Correct" or "Your answer" at its end.
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
            .foregroundStyle(.secondary)
            .accessibilityHidden(true)
        }

        label()
          .frame(maxWidth: .infinity, alignment: .leading)
          .multilineTextAlignment(.leading)

        if let tag {
          tag
        }

        if let result {
          Text(resultLabel(result))
            .font(.caption.weight(.semibold))
            .foregroundStyle(result == .right ? Color.blue : Color.pink)
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

/// The card behind an option: a hairline at rest, a firm outline while picked, soft blue or pink
/// once graded. Disabled options keep their colors, so a graded question stays readable.
struct AnswerOptionStyle: ButtonStyle {
  var isPicked: Bool
  var result: AnswerOptionResult?

  func makeBody(configuration: Configuration) -> some View {
    let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)

    configuration.label
      .font(.body.weight(.medium))
      .foregroundStyle(.primary)
      .padding(.horizontal, 14)
      .padding(.vertical, 12)
      .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
      .background(fill.opacity(configuration.isPressed ? 0.8 : 1), in: shape)
      .overlay(shape.strokeBorder(stroke, lineWidth: isPicked || result != nil ? 2 : 1))
      .contentShape(shape)
  }

  private var fill: Color {
    switch result {
    case .right: Color.blue.opacity(0.1)
    case .wrong: Color.pink.opacity(0.1)
    case nil: isPicked ? Color(.secondarySystemFill) : Color(.secondarySystemGroupedBackground)
    }
  }

  private var stroke: Color {
    switch result {
    case .right: .blue
    case .wrong: .pink
    case nil: isPicked ? .primary : Color(.separator)
    }
  }
}

/// The number keys 1 to 9 pick the options in order on a hardware keyboard.
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
