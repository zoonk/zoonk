import SwiftUI

/// Main's outline `Toggle`, a few words the learner turns on or off: off, the stronger line and
/// muted words; on, the pick's fill in the line's place and ink words, so turning it never changes
/// its width. VoiceOver reads it as a toggle that's on or off. Several wrap 8pt apart in a
/// `FlowLayout`.
struct ToggleChip<Label: View>: View {
  let isOn: Bool
  var words = ToggleChipWords.label
  let action: () -> Void
  @ViewBuilder let label: Label

  var body: some View {
    Button(action: action) {
      label
    }
    .buttonStyle(ToggleChipStyle(isOn: isOn, words: words))
    .choiceTraits(.several, isPicked: isOn)
  }
}

extension ToggleChip where Label == Text {
  init(
    _ title: Text, isOn: Bool, words: ToggleChipWords = .label, action: @escaping () -> Void
  ) {
    self.init(isOn: isOn, words: words, action: action) { title }
  }
}

enum ToggleChipWords {
  /// Main's `Toggle`: a short label, such as an activity a plan practices.
  case label
  /// Main's profile chip: an answer about the learner, in reading text.
  case answer
}

private struct ToggleChipStyle: ButtonStyle {
  let isOn: Bool
  let words: ToggleChipWords

  @Environment(\.isEnabled) private var isEnabled

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .multilineTextAlignment(.leading)
      .typeStyle(words == .label ? .rowTitle : .body)
      .foregroundStyle(isOn ? Color(.foreground) : .mutedForeground)
      .padding(.horizontal, words == .label ? ZoonkButtonStyle.horizontalPadding(.large) : 14)
      .padding(.vertical, 6)
      .frame(minHeight: ZoonkButtonStyle.height(.large))
      .answerSurface(
        isOn ? .picked : .idle, cornerRadius: Radius.lg, isPressed: configuration.isPressed
      )
      .opacity(isEnabled ? 1 : 0.5)
  }
}
