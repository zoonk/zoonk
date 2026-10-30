import SwiftUI

/// SwiftUI doesn't pass a vertical `TextField`'s label to accessibility, so VoiceOver would name it
/// by its scroll bar.
struct MultilineTextField: View {
  @Binding var text: String
  var selection: Binding<TextSelection?>?
  var prompt: Text?
  let label: Text

  var body: some View {
    field
      .accessibilityLabel(label)
  }

  @ViewBuilder
  private var field: some View {
    if let selection {
      TextField(text: $text, selection: selection, prompt: prompt, axis: .vertical) { label }
    } else {
      TextField(text: $text, prompt: prompt, axis: .vertical) { label }
    }
  }
}
