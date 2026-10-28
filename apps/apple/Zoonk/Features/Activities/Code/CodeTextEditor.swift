import SwiftUI
import UIKit

/// SwiftUI's TextEditor doesn't expose smart punctuation traits. Keep the native text view and
/// its keyboard, selection and Dynamic Type behavior while preserving literal program text.
struct CodeTextEditor: UIViewRepresentable {
  @Binding var text: String
  let label: String

  func makeUIView(context: Context) -> UITextView {
    let view = UITextView()
    view.delegate = context.coordinator
    view.accessibilityLabel = label
    view.isScrollEnabled = false
    view.backgroundColor = .secondarySystemBackground
    view.autocorrectionType = .no
    view.autocapitalizationType = .none
    view.smartQuotesType = .no
    view.smartDashesType = .no
    view.smartInsertDeleteType = .no
    view.adjustsFontForContentSizeCategory = true
    let descriptor = UIFontDescriptor.preferredFontDescriptor(withTextStyle: .body).withDesign(
      .monospaced)!
    view.font = UIFont(descriptor: descriptor, size: 0)
    return view
  }

  func updateUIView(_ view: UITextView, context: Context) {
    context.coordinator.editor = self
    view.accessibilityLabel = label
    if view.text != text { view.text = text }
  }

  func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
    guard let width = proposal.width else { return nil }
    let measured = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
    let lineHeight = (uiView.font ?? UIFont.preferredFont(forTextStyle: .body)).lineHeight
    let minimumHeight =
      lineHeight + uiView.textContainerInset.top + uiView.textContainerInset.bottom
    return CGSize(width: width, height: max(minimumHeight, measured.height))
  }

  func makeCoordinator() -> Coordinator { Coordinator(editor: self) }

  final class Coordinator: NSObject, UITextViewDelegate {
    var editor: CodeTextEditor
    init(editor: CodeTextEditor) { self.editor = editor }
    func textViewDidChange(_ textView: UITextView) { editor.text = textView.text }
  }
}
