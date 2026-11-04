import SwiftUI

struct ChartsCanvas<Content: View>: View {
  @ViewBuilder let content: Content

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      content
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding()
    .background(.muted, in: .rect(cornerRadius: Radius.xl, style: .continuous))
    .accessibilityElement(children: .contain)
  }
}

struct ChartsReadout: View {
  let text: String
  var style: Color = .primary

  var body: some View {
    Text(verbatim: text)
      .typeStyle(.readout)
      .foregroundStyle(style)
      .contentTransition(.numericText())
  }
}

struct ChartsChoiceStyle: ButtonStyle {
  enum State {
    case plain, selected, right, wrong
  }

  var state: State = .plain

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .typeStyle(.body.weight(state == .plain ? .regular : .medium).monospaced())
      .foregroundStyle(foreground)
      .multilineTextAlignment(.center)
      .frame(maxWidth: .infinity, minHeight: 44)
      .padding(.horizontal, 12)
      .answerSurface(tone, isPressed: configuration.isPressed)
  }

  private var foreground: Color {
    switch state {
    case .right: .successText
    case .wrong: .destructiveText
    default: Color(.foreground)
    }
  }

  private var tone: AnswerTone {
    switch state {
    case .plain: .idle
    case .selected: .picked
    case .right: .right
    case .wrong: .wrong
    }
  }
}

extension View {
  /// VoiceOver adjusts it by swiping up and down; with a hardware keyboard it takes focus and moves
  /// with the arrows (a step) and Page Up/Down (ten).
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

enum ChartsPlot {
  static let space = "chartsPlot"
}

/// A dot inside a 44-point target, so a finger can grab it without covering the mark and a swipe
/// elsewhere still scrolls the lesson.
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

struct ChartsCaption: View {
  let text: String

  init(_ text: String) {
    self.text = text
  }

  var body: some View {
    Text(verbatim: text)
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
  }
}

extension View {
  /// VoiceOver reads the chart's summary and its handles, not each mark. Hides the whole chart:
  /// Swift Charts also hides a mark's annotation from sight when the mark itself is hidden.
  func chartsMarksHidden() -> some View {
    accessibilityHidden(true)
  }
}

extension View {
  /// A plot places its labels by value in a frame that doesn't grow, so they stop growing at the
  /// largest standard size, where they still fit beside each other. The words and readouts around
  /// the plot keep growing.
  func chartsPlotText() -> some View {
    dynamicTypeSize(...DynamicTypeSize.xxxLarge)
  }
}

extension View {
  /// Outlines a chart label in the background color, as main does, so a line crossing it never
  /// cuts through its letters.
  func chartsLabelHalo() -> some View {
    textRenderer(ChartsLabelHalo())
  }
}

extension GraphicsContext {
  /// Draws a label on a Canvas with the halo `chartsLabelHalo()` gives text views.
  func drawChartsLabel(_ text: Text, at point: CGPoint) {
    let label = resolve(text)
    ChartsLabelHalo.draw(in: self) { $0.draw(label, at: point) }
  }
}

private struct ChartsLabelHalo: TextRenderer {
  private static let width: CGFloat = 2

  var displayPadding: EdgeInsets {
    EdgeInsets(top: Self.width, leading: Self.width, bottom: Self.width, trailing: Self.width)
  }

  func draw(layout: Text.Layout, in context: inout GraphicsContext) {
    Self.draw(in: context) { context in
      for line in layout {
        context.draw(line)
      }
    }
  }

  /// GraphicsContext can't stroke text, so the halo is the label drawn in the background color at
  /// twelve points around it, under the label itself.
  static func draw(in context: GraphicsContext, _ label: (inout GraphicsContext) -> Void) {
    for step in 0..<12 {
      let angle = Double(step) * .pi / 6
      var halo = context
      halo.addFilter(
        .shadow(
          color: Color(.background), radius: 0, x: cos(angle) * width,
          y: sin(angle) * width, options: .shadowOnly))
      label(&halo)
    }

    var text = context
    label(&text)
  }
}
