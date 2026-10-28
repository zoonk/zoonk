import Charts
import SwiftUI

/// The surface a chart activity draws on (main's `ActivityCanvas`): a quiet panel under the prompt
/// that holds the figure, its readouts and its controls.
struct ChartsCanvas<Content: View>: View {
  @ViewBuilder let content: Content

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      content
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding()
    .background(.fill.quaternary, in: .rect(cornerRadius: 16, style: .continuous))
    .accessibilityElement(children: .contain)
  }
}

/// The value the learner is changing, big enough to read at a glance (main's `ActivityReadout`).
struct ChartsReadout: View {
  let text: String
  var style: Color = .primary

  var body: some View {
    Text(verbatim: text)
      .font(.title2.weight(.semibold).monospacedDigit())
      .foregroundStyle(style)
      .contentTransition(.numericText())
  }
}

/// A thing to tap on a canvas (a span, an ending, a next move), with main's select-grid states:
/// ink when picked, soft blue when it's the answer, soft pink when it was a wrong pick.
struct ChartsChoiceStyle: ButtonStyle {
  enum State {
    case plain, selected, right, wrong
  }

  var state: State = .plain

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .font(.subheadline.weight(state == .plain ? .regular : .medium).monospacedDigit())
      .foregroundStyle(foreground)
      .multilineTextAlignment(.center)
      .frame(maxWidth: .infinity, minHeight: 44)
      .padding(.horizontal, 12)
      .background(background, in: .rect(cornerRadius: 12, style: .continuous))
      .overlay {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
          .strokeBorder(stroke, lineWidth: state == .plain ? 1 : 2)
      }
      .opacity(configuration.isPressed ? 0.7 : 1)
      .contentShape(.rect(cornerRadius: 12))
  }

  private var foreground: Color {
    switch state {
    case .right: .success
    case .wrong: .destructive
    default: .primary
    }
  }

  private var background: AnyShapeStyle {
    switch state {
    case .plain: AnyShapeStyle(.background)
    case .selected: AnyShapeStyle(.fill.quaternary)
    case .right: AnyShapeStyle(Color.success.opacity(0.15))
    case .wrong: AnyShapeStyle(Color.destructive.opacity(0.15))
    }
  }

  private var stroke: Color {
    switch state {
    case .plain: Color(.separator)
    case .selected: .primary
    case .right: .success
    case .wrong: .destructive
    }
  }
}

extension View {
  /// Something the learner moves along one line (a dot, a handle, a split line): VoiceOver adjusts
  /// it by swiping up and down, and with a hardware keyboard it takes focus and moves with the
  /// arrows (a step) and Page Up/Down (ten), like main's place handles and sliders.
  func chartsAdjustable(
    label: Text,
    value: String,
    isEnabled: Bool = true,
    move: @escaping (_ steps: Int) -> Void
  ) -> some View {
    modifier(ChartsAdjustable(label: label, value: value, isEnabled: isEnabled, move: move))
  }
}

private struct ChartsAdjustable: ViewModifier {
  let label: Text
  let value: String
  let isEnabled: Bool
  let move: (Int) -> Void

  @FocusState private var isFocused: Bool

  func body(content: Content) -> some View {
    content
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(label)
      .accessibilityValue(Text(verbatim: value))
      .accessibilityAdjustableAction { direction in
        guard isEnabled else { return }
        switch direction {
        case .increment: move(1)
        case .decrement: move(-1)
        @unknown default: break
        }
      }
      .focusable(isEnabled, interactions: .edit)
      .focused($isFocused)
      // Touching or clicking a handle gives it the keyboard, as clicking a slider does on the web.
      .simultaneousGesture(
        DragGesture(minimumDistance: 0).onChanged { _ in
          if !isFocused { isFocused = true }
        }, isEnabled: isEnabled
      )
      .onKeyPress(keys: [.leftArrow, .rightArrow, .upArrow, .downArrow, .pageUp, .pageDown]) {
        press in
        guard isEnabled else { return .ignored }
        switch press.key {
        case .leftArrow, .downArrow: move(-1)
        case .rightArrow, .upArrow: move(1)
        case .pageDown: move(-10)
        default: move(10)
        }
        return .handled
      }
  }
}

/// The coordinate space of a chart's overlay, where handles read their drags.
enum ChartsPlot {
  static let space = "chartsPlot"
}

/// A round handle the learner drags: a visible dot inside a 44-point target, so a finger can grab
/// it without covering the mark and a swipe elsewhere still scrolls the lesson.
struct ChartsHandle: View {
  var tint: Color = .primary
  var isEnabled = true

  var body: some View {
    Circle()
      .fill(tint)
      .overlay { Circle().strokeBorder(.background, lineWidth: 2) }
      .frame(width: 22, height: 22)
      .frame(width: 44, height: 44)
      .contentShape(.circle)
      .opacity(isEnabled ? 1 : 0.6)
  }
}

/// A line of small print on a canvas, like an axis name or a hint.
struct ChartsCaption: View {
  let text: String

  init(_ text: String) {
    self.text = text
  }

  var body: some View {
    Text(verbatim: text)
      .font(.footnote)
      .foregroundStyle(.secondary)
  }
}

/// Marks under a chart the learner moves by its handles: VoiceOver reads the chart's summary and
/// the handles, not each mark.
struct ChartsHiddenMarks<Content: ChartContent>: ChartContent {
  @ChartContentBuilder let content: Content

  var body: some ChartContent {
    content.accessibilityHidden(true)
  }
}
