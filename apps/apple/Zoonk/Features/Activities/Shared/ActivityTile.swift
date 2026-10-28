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
      .font(.subheadline.weight(mark == .selected || mark == .wrong ? .semibold : .regular))
      .foregroundStyle(foreground)
      .padding(.horizontal, isCompact ? 4 : 12)
      .padding(.vertical, isCompact ? 6 : 10)
      .frame(minHeight: 44)
      .background(background, in: .rect(cornerRadius: 12))
      .overlay {
        RoundedRectangle(cornerRadius: 12)
          .strokeBorder(stroke, lineWidth: mark == .plain || mark == .dimmed ? 1 : 2)
      }
      .opacity(configuration.isPressed ? 0.75 : mark == .dimmed ? 0.6 : 1)
      .contentShape(.rect(cornerRadius: 12))
  }

  @ViewBuilder
  private func content(_ configuration: Configuration) -> some View {
    if isCompact {
      configuration.label
        .frame(maxWidth: .infinity)
        .overlay(alignment: .topTrailing) {
          if let symbol = mark.symbol {
            Image(systemName: symbol)
              .font(.caption2.weight(.bold))
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
    default: Color(.systemBackground)
    }
  }

  private var stroke: Color {
    switch mark {
    case .selected: .primary
    case .right: .success
    case .wrong: .destructive
    default: Color(.separator)
    }
  }
}

struct ActivityDropPanel<Content: View>: View {
  let isReady: Bool
  let isTargeted: Bool
  @ViewBuilder let content: Content

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      content
    }
    .padding(10)
    .frame(maxWidth: .infinity, alignment: .topLeading)
    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 16))
    .overlay {
      if isReady || isTargeted {
        RoundedRectangle(cornerRadius: 16)
          .strokeBorder(.primary.opacity(isTargeted ? 1 : 0.35), lineWidth: 2)
      }
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
              .foregroundStyle(.secondary)
          }
        }
        .font(.subheadline)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12))
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
      .font(.footnote)
      .foregroundStyle(.secondary)
      .monospacedDigit()
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
