import SwiftUI

/// SwiftUI doesn't pass a vertical `TextField`'s label to accessibility, so VoiceOver would name it
/// by its scroll bar. Its Return key also types a new line and never runs `.onSubmit`, so pass
/// `onSubmit` here instead: Return then submits, while pasted text keeps its lines.
struct MultilineTextField: View {
  @Binding var text: String
  var limit: Int?
  var selection: Binding<TextSelection?>?
  var prompt: Text?
  let label: Text
  var onSubmit: (@MainActor () -> Void)?

  var body: some View {
    field
      .accessibilityLabel(label)
  }

  @ViewBuilder
  private var field: some View {
    if let limit {
      FittedTextInput(text: $text, limit: limit) { text, selection in
        TextField(
          text: submitting(text), selection: selection, prompt: prompt?.fieldPrompt(),
          axis: .vertical
        ) {
          label
        }
      }
    } else if let selection {
      TextField(
        text: submitting($text), selection: selection, prompt: prompt?.fieldPrompt(),
        axis: .vertical
      ) {
        label
      }
    } else {
      TextField(text: submitting($text), prompt: prompt?.fieldPrompt(), axis: .vertical) { label }
    }
  }

  private func submitting(_ input: Binding<String>) -> Binding<String> {
    guard let onSubmit else {
      return input
    }

    return Binding {
      input.wrappedValue
    } set: { typed in
      if Self.isReturn(from: input.wrappedValue, to: typed) {
        onSubmit()
      } else {
        input.wrappedValue = typed
      }
    }
  }

  /// Return typed at the caret, over a selection or not, rather than a paste that happens to hold
  /// a new line.
  nonisolated static func isReturn(from text: String, to typed: String) -> Bool {
    let inserted = TextEdit(from: text, to: typed).inserted

    return inserted.count == 1 && inserted.first?.isNewline == true
  }
}
