import SwiftUI

/// How a tile the learner moves or picks reads: waiting, picked up (ink, never blue, since blue
/// would say "right"), and after the check right (soft blue) or wrong (soft pink).
enum ActivityTileMark: Hashable, Sendable {
  case plain, selected, right, wrong, dimmed

  var symbol: String? {
    switch self {
    case .right: "checkmark"
    case .wrong: "xmark"
    default: nil
    }
  }

  /// What VoiceOver adds after the tile's text once it's checked.
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

/// A tile in an activity: an item to sort, a card to match, a name to place. Its text wraps at
/// any text size, and its verdict shows as a mark as well as a color.
struct ActivityTileStyle: ButtonStyle {
  let mark: ActivityTileMark
  /// A grid's square: its value centered, the verdict's mark in a corner, little padding.
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

/// A place tiles go (a group, a column, a slot): a soft panel that shows when a picked-up tile can
/// land in it, and while a drag hovers over it.
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

/// What the check found, one card each with its why: a misplaced item, a missed pair, a mistake.
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

/// A small caption over or under a canvas: what's left to do, a count, a hint.
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

/// Says a change out loud for VoiceOver users, as main's live regions do.
@MainActor
func announceActivityChange(_ text: String) {
  AccessibilityNotification.Announcement(text).post()
}

/// 1–9 pick one of a canvas's choices on a hardware keyboard, as the player's options do.
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
