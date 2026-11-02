import SwiftUI

/// SwiftUI doesn't pass a vertical `TextField`'s label to accessibility, so VoiceOver would name it
/// by its scroll bar. Its Return key also types a new line and never runs `.onSubmit`, so pass
/// `onSubmit` here instead: Return then submits, while pasted text keeps its lines.
struct MultilineTextField: View {
  @Binding var text: String
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
    if let selection {
      TextField(text: typed, selection: selection, prompt: prompt, axis: .vertical) { label }
    } else {
      TextField(text: typed, prompt: prompt, axis: .vertical) { label }
    }
  }

  private var typed: Binding<String> {
    guard let onSubmit else {
      return $text
    }

    return Binding {
      text
    } set: { typed in
      if Self.isReturn(from: text, to: typed) {
        onSubmit()
      } else {
        text = typed
      }
    }
  }

  /// Return typed at the caret, over a selection or not, rather than a paste that happens to hold
  /// a new line.
  static func isReturn(from text: String, to typed: String) -> Bool {
    let old = Array(text)
    let new = Array(typed)
    let prefix = zip(old, new).prefix { $0 == $1 }.count
    let suffix = min(
      zip(old.reversed(), new.reversed()).prefix { $0 == $1 }.count,
      old.count - prefix, new.count - prefix)
    let inserted = new[prefix..<(new.count - suffix)]

    return inserted.count == 1 && inserted.first?.isNewline == true
  }
}
