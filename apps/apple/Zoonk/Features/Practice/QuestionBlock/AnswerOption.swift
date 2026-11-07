import SwiftUI

/// Main's `AnswerOptionResult`. A guess counts as neither right nor wrong.
enum AnswerOptionResult: Equatable {
  case guess
  case right
  case wrong
}

/// Main's `AnswerOption`: its number key, its words and, once checked, the word its result shows.
/// The first nine answer to their number key on a hardware keyboard, as on the web.
struct AnswerOption<Label: View>: View {
  var marker: Int?
  var isPicked = false
  var result: AnswerOptionResult?
  /// The learner's pick was a guess, so it's "Your guess", never "Your answer".
  var isGuessed = false
  var isLocked = false
  var tag: AnyView?
  let action: () -> Void
  @ViewBuilder let label: () -> Label

  var body: some View {
    Button(action: action) {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        if let marker {
          KeyMarker(number: marker)
        }

        AccessibilityStack(alignment: .firstTextBaseline, spacing: 12) {
          label()
            .frame(maxWidth: .infinity, alignment: .leading)
            .multilineTextAlignment(.leading)

          if let tag {
            tag
          } else if let result {
            Text(resultLabel(result))
              .typeStyle(.tag)
              .foregroundStyle(tagColor(result))
          }
        }
      }
    }
    .buttonStyle(AnswerOptionStyle(isPicked: isPicked, result: result))
    .disabled(isLocked)
    .modifier(NumberKeyShortcut(number: marker, isEnabled: !isLocked))
    .accessibilityAddTraits(isPicked ? .isSelected : [])
  }

  /// A right pick says whose it is, so it isn't called correct twice under its verdict.
  private func resultLabel(_ result: AnswerOptionResult) -> LocalizedStringResource {
    let yourGuess = LocalizedStringResource(
      "Your guess", table: "Practice",
      comment: "Mark beside the learner's pick when it counts as neither right nor wrong.")
    let yourAnswer = LocalizedStringResource(
      "Your answer", table: "Practice",
      comment: "Mark beside the learner's wrong pick once a question is graded.")

    switch result {
    case .guess:
      return yourGuess
    case .right:
      if isPicked {
        return isGuessed ? yourGuess : yourAnswer
      }

      return LocalizedStringResource(
        "Correct", table: "Practice",
        comment: "Mark beside the right option once a question is graded.")
    case .wrong:
      return yourAnswer
    }
  }

  private func tagColor(_ result: AnswerOptionResult) -> Color {
    switch result {
    case .guess: .mutedForeground
    case .right: .successText
    case .wrong: .destructiveText
    }
  }
}

/// Main's `Kbd`: the key that picks an option.
private struct KeyMarker: View {
  let number: Int

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Radius.sm, style: .continuous)

    Text(number, format: .number)
      .typeStyle(.small.monospaced().weight(.medium))
      .foregroundStyle(.mutedForeground)
      .padding(.horizontal, 4)
      .frame(minWidth: 20, minHeight: 20)
      .background(Color(.foreground).opacity(0.04), in: shape)
      .overlay(shape.strokeBorder(Color(.foreground).opacity(0.12)))
      .accessibilityHidden(true)
  }
}

/// Disabled options keep their colors, so a graded question stays readable.
struct AnswerOptionStyle: ButtonStyle {
  var isPicked: Bool
  var result: AnswerOptionResult?

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .typeStyle(.button)
      .foregroundStyle(Color(.foreground))
      .padding(.horizontal, 14)
      .padding(.vertical, 13)
      .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
      .answerSurface(tone, isPressed: configuration.isPressed)
  }

  private var tone: AnswerTone {
    switch result {
    case .guess: .guess
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
