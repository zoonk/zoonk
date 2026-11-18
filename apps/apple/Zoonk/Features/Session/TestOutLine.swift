import SwiftUI

/// Main's one quiet line before a chapter the learner may already know, the link in ink and
/// underlined in its muted words.
struct TestOutLine: View {
  let open: () -> Void

  var body: some View {
    Button(action: open) {
      Text(line)
        .typeStyle(.meta)
        .foregroundStyle(.mutedForeground)
    }
    // Borderless, so in a list row only the line answers a tap.
    .buttonStyle(.borderless)
  }

  private var line: AttributedString {
    let question = String(localized: "Already know this chapter?", table: "Today")
    var link = AttributedString(localized: "Take the test", table: "Tutor")
    link.foregroundColor = Color(.foreground)
    link.underlineStyle = .single

    // The words and the link sit as two sentences do, with no space after a full-width ？.
    let space = [question, ""].joinedSentences().dropFirst(question.count)
    return AttributedString(question + space) + link
  }
}
