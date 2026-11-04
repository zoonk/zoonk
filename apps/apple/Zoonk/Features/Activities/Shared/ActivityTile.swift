import SwiftUI

/// Picked up is ink, never blue, since blue would say "right".
enum ActivityTileMark: Hashable, Sendable {
  case plain, selected, right, wrong, dimmed

  var symbol: String? {
    switch self {
    case .right: "checkmark"
    case .wrong: "xmark"
    default: nil
    }
  }

  var verdict: Text? {
    switch self {
    case .right:
      Text("Right", tableName: "Activities", comment: "VoiceOver: a tile the learner placed right")
    case .wrong:
      Text("Wrong", tableName: "Activities", comment: "VoiceOver: a tile the learner placed wrong")
    default:
      nil
    }
  }
}

struct ActivityTileStyle: ButtonStyle {
  let mark: ActivityTileMark
  var isCompact = false

  func makeBody(configuration: Configuration) -> some View {
    content(configuration)
      .typeStyle(.body.weight(mark == .selected || mark == .wrong ? .semibold : .regular))
      .foregroundStyle(foreground)
      .padding(.horizontal, isCompact ? 4 : 12)
      .padding(.vertical, isCompact ? 6 : 10)
      .frame(minHeight: 44)
      .answerSurface(tone, isPressed: configuration.isPressed)
      .opacity(mark == .dimmed ? 0.6 : 1)
  }

  @ViewBuilder
  private func content(_ configuration: Configuration) -> some View {
    if isCompact {
      configuration.label
        .frame(maxWidth: .infinity)
        .overlay(alignment: .topTrailing) {
          if let symbol = mark.symbol {
            Image(systemName: symbol)
              .typeStyle(.small.bold())
              .accessibilityHidden(true)
          }
        }
    } else {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        configuration.label
          .frame(maxWidth: .infinity, alignment: .leading)

        if let symbol = mark.symbol {
          Image(systemName: symbol)
            .fontWeight(.semibold)
            .accessibilityHidden(true)
        }
      }
      .multilineTextAlignment(.leading)
    }
  }

  private var foreground: Color {
    switch mark {
    case .right: .successText
    case .wrong: .destructiveText
    default: Color(.foreground)
    }
  }

  private var tone: AnswerTone {
    switch mark {
    case .selected: .picked
    case .right: .right
    case .wrong: .wrong
    case .plain, .dimmed: .idle
    }
  }
}

struct ActivityReasonList: View {
  struct Reason: Identifiable {
    let id: String
    let text: String
    let why: String?
  }

  let reasons: [Reason]

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      ForEach(reasons) { reason in
        VStack(alignment: .leading, spacing: 2) {
          LessonRichText(reason.text)
          if let why = reason.why {
            LessonRichText(why)
              .foregroundStyle(.mutedForeground)
          }
        }
        .typeStyle(.note)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .panel(cornerRadius: 12)
        .accessibilityElement(children: .combine)
      }
    }
  }
}

struct ActivityCaption: View {
  let text: Text

  init(_ text: Text) {
    self.text = text
  }

  var body: some View {
    text
      .typeStyle(.data)
      .foregroundStyle(.mutedForeground)
  }
}

@MainActor
func announceActivityChange(_ text: String) {
  AccessibilityNotification.Announcement(text).post()
}

struct ActivityNumberKey: ViewModifier {
  let index: Int

  func body(content: Content) -> some View {
    if index < 9, let key = "\(index + 1)".first {
      content.keyboardShortcut(KeyEquivalent(key), modifiers: [])
    } else {
      content
    }
  }
}
