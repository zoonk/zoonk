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
    let line = AttributedString(
      localized: "Already know this? **Take the test**", table: "Today",
      comment: "Skips the next lesson's chapter with its test")

    return line.runs[\.inlinePresentationIntent].reduce(into: AttributedString()) {
      result, run in
      var piece = AttributedString(line[run.1])

      if run.0?.contains(.stronglyEmphasized) == true {
        piece.inlinePresentationIntent = nil
        piece.foregroundColor = Color(.foreground)
        piece.underlineStyle = .single
      }

      result += piece
    }
  }
}
