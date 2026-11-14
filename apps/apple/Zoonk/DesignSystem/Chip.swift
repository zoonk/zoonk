import SwiftUI

/// Main's `Eyebrow`: the one small line over a title, as a chip with an optional mark before its
/// words (rule 7). It holds a label of a few words, never a control or a sentence; `success` is main's
/// `SuccessEyebrow`, green with a check, for what just finished. Over a task's, a card's, a sheet's
/// or a step's title only: a page that has the app's bar has no line over its title.
struct Chip: View {
  enum Tone {
    case neutral
    case success
  }

  let text: Text
  var systemImage: String?
  var tone = Tone.neutral

  init(_ text: Text, systemImage: String? = nil, tone: Tone = .neutral) {
    self.text = text
    self.systemImage = tone == .success ? "checkmark" : systemImage
    self.tone = tone
  }

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 6) {
      if let systemImage {
        Image(systemName: systemImage)
          .imageScale(.small)
          .accessibilityHidden(true)
      }

      text
    }
    // Before the chip's own muted style, which only fills in what this leaves unset.
    .foregroundStyle(tone == .success ? Color.successText : Color.mutedForeground)
    .chip(wraps: true)
  }
}

extension View {
  /// The chip's look, for a word at a row's end that isn't a count (a count is `.badge(_:)`). Never a
  /// colored badge. One that `wraps` takes more lines instead of overflowing.
  func chip(wraps: Bool = false) -> some View {
    typeStyle(.chip)
      .foregroundStyle(.mutedForeground)
      .padding(.horizontal, 8)
      .padding(.vertical, 3)
      .frame(minHeight: 22)
      .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).strokeBorder(.input))
      .fixedSize(horizontal: !wraps, vertical: true)
  }
}
