import SwiftUI

struct LessonOption: Identifiable, Hashable {
  let id: String
  let text: String
  var detail: String?
  var isCorrect: Bool?
  /// A picture option's description, shown with its text until its picture is drawn.
  var pictureAlt: String?
  /// A picture option's drawn picture.
  var picture: LessonStepImage?
}

/// A question's options, one per row. Number keys pick them on a hardware keyboard, as on main.
/// After the check, the right option reads in soft blue and a wrong pick in soft pink.
struct LessonOptionList: View {
  let options: [LessonOption]
  let selectedId: String?
  let isChecked: Bool
  let isLocked: Bool
  /// A guess is never wrong: a missed pick keeps its plain look.
  var isGuess = false
  let select: (String) -> Void

  var body: some View {
    VStack(spacing: 10) {
      ForEach(Array(options.enumerated()), id: \.element.id) { index, option in
        Button {
          select(option.id)
        } label: {
          HStack(alignment: .firstTextBaseline, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
              if let picture = option.picture {
                LessonPictureView(image: picture, description: nil, isPending: false)
                  .accessibilityHidden(true)
              }

              LessonRichText(option.text)
              if let detail = option.detail {
                Text(detail)
                  .font(.subheadline)
                  .foregroundStyle(.secondary)
              }
              if option.picture == nil, let pictureAlt = option.pictureAlt {
                Text(pictureAlt)
                  .font(.footnote)
                  .foregroundStyle(.secondary)
              }
            }
            Spacer(minLength: 0)
            // Decorative: the option's value says the verdict. A checkmark inside a button would
            // also make VoiceOver call the right option "selected".
            if let symbol = mark(option).symbol {
              Image(systemName: symbol)
                .accessibilityHidden(true)
            }
          }
        }
        .buttonStyle(LessonOptionStyle(mark: mark(option)))
        .disabled(isLocked)
        .modifier(NumberShortcut(index: index))
        .accessibilityAddTraits(option.id == selectedId ? .isSelected : [])
        .accessibilityValue(verdictValue(option))
      }
    }
  }

  /// After the check, VoiceOver says which option was right and which one the learner picked.
  private func verdictValue(_ option: LessonOption) -> Text {
    switch mark(option) {
    case .right:
      Text("Correct answer", tableName: "Player", comment: "Before the right answer after a miss")
    case .wrong:
      Text(
        "Your answer", tableName: "Player",
        comment: "VoiceOver value of the option the learner picked, which was wrong")
    default:
      Text(verbatim: "")
    }
  }

  private func mark(_ option: LessonOption) -> LessonOptionStyle.Mark {
    let isSelected = option.id == selectedId

    guard isChecked else {
      return isSelected ? .selected : .plain
    }

    if option.isCorrect == true {
      return .right
    }

    if isSelected {
      return isGuess ? .selected : .wrong
    }

    return .dimmed
  }
}

/// 1–9 pick an option with a hardware keyboard.
private struct NumberShortcut: ViewModifier {
  let index: Int

  func body(content: Content) -> some View {
    if index < 9, let key = "\(index + 1)".first {
      content.keyboardShortcut(KeyEquivalent(key), modifiers: [])
    } else {
      content
    }
  }
}

/// An option card: the plain secondary fill, the tint when picked, and the verdict's soft color.
struct LessonOptionStyle: ButtonStyle {
  enum Mark {
    case plain, selected, right, wrong, dimmed

    var symbol: String? {
      switch self {
      case .right: "checkmark"
      case .wrong: "xmark"
      default: nil
      }
    }
  }

  let mark: Mark

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.body.weight(.medium))
      .foregroundStyle(foreground)
      .multilineTextAlignment(.leading)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding()
      .background(background, in: .rect(cornerRadius: 16))
      .overlay {
        RoundedRectangle(cornerRadius: 16)
          .strokeBorder(stroke, lineWidth: mark == .plain || mark == .dimmed ? 0 : 2)
      }
      .opacity(configuration.isPressed ? 0.75 : mark == .dimmed ? 0.6 : 1)
      .contentShape(.rect(cornerRadius: 16))
  }

  private var foreground: Color {
    switch mark {
    case .right: .success
    case .wrong: .destructive
    default: .primary
    }
  }

  private var background: Color {
    switch mark {
    case .selected: Color(.quaternarySystemFill)
    case .right: Color.success.opacity(0.15)
    case .wrong: Color.destructive.opacity(0.15)
    default: Color(.secondarySystemBackground)
    }
  }

  private var stroke: Color {
    switch mark {
    case .selected: .primary
    case .right: .success
    case .wrong: .destructive
    default: .clear
    }
  }
}

/// A word tile in a word bank, picked into an answer.
struct LessonWordTile: View {
  let word: String
  var romanization: String?
  let isUsed: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      VStack(spacing: 0) {
        Text(word)
        if let romanization {
          Text(romanization)
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }
    }
    .buttonStyle(.bordered)
    .opacity(isUsed ? 0.3 : 1)
    .disabled(isUsed)
  }
}
