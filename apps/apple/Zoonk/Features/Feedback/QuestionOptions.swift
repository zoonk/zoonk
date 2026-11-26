import SwiftUI

extension View {
  /// Main's `ContentFeedbackMenu` on a question's screen: its "…" with Report a problem about the
  /// question in view. Nil hides it, as on a timed question until it's answered, since its clock
  /// never waits on a menu.
  func questionOptions(_ target: FeedbackContext?) -> some View {
    modifier(QuestionOptions(target: target))
  }
}

private struct QuestionOptions: ViewModifier {
  let target: FeedbackContext?

  /// What the open form reports, kept while it's open, so the next question doesn't change it.
  @State private var reporting: FeedbackContext?

  func body(content: Content) -> some View {
    content
      .taskOptions(isShown: target != nil, label: Text("Question options", tableName: "Practice")) {
        Button {
          reporting = target
        } label: {
          Label {
            Text("Report a problem", tableName: "Feedback")
          } icon: {
            Image(systemName: "flag")
          }
        }
      }
      .feedbackSheet(
        isPresented: Binding {
          reporting != nil
        } set: {
          if !$0 { reporting = nil }
        },
        context: reporting ?? target ?? FeedbackContext(screen: "question"), isReport: true)
  }
}
