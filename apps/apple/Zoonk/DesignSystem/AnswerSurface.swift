import SwiftUI

/// Main's answer tones (`answer-tone.ts`). A pick is ink, never blue, since blue would say "right".
enum AnswerTone {
  case idle
  case picked
  case right
  case wrong
}

extension View {
  /// An answer option's or a tile's ground: at rest the stronger line; the learner's pick a 2pt ink
  /// ring on its tint; checked, a ring in its verdict's color on that color's tint.
  func answerSurface(_ tone: AnswerTone, cornerRadius: CGFloat = 12, isPressed: Bool = false)
    -> some View
  {
    let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)

    return background(fill(tone, isPressed: isPressed), in: shape)
      .overlay(shape.strokeBorder(stroke(tone), lineWidth: lineWidth(tone)))
      .contentShape(shape)
  }
}

private func fill(_ tone: AnswerTone, isPressed: Bool) -> Color {
  switch tone {
  case .idle: isPressed ? Color.muted.opacity(0.6) : .clear
  case .picked: .selectedTint
  case .right: Color.success.opacity(0.09)
  case .wrong: Color.destructive.opacity(0.09)
  }
}

private func stroke(_ tone: AnswerTone) -> Color {
  switch tone {
  case .idle: .input
  case .picked: Color(.foreground)
  case .right: .success
  case .wrong: .destructive
  }
}

private func lineWidth(_ tone: AnswerTone) -> CGFloat {
  switch tone {
  case .idle: 1
  case .picked: 2
  case .right, .wrong: 1.5
  }
}
