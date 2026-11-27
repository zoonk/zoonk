import SwiftUI

/// What an open test puts in its task's bar. A question names what it tests over one segment a
/// question; the wait and the result keep ✕ alone, since their own title is the screen's.
enum TestTop: Equatable {
  case open
  case question(TestQuestionTop)

  var question: TestQuestionTop? {
    if case .question(let top) = self { top } else { nil }
  }
}

/// A test question's bar: what it tests, its place among the test's questions and the ways out
/// behind ✕.
struct TestQuestionTop: Equatable {
  /// A course topic's chapter, "Reading", "Listening", a Focus subject.
  let title: String
  /// Questions answered before this one.
  let answered: Int
  /// The most questions the test asks.
  let total: Int
  /// The sizes of the test's sections in order, where it has them.
  var groups: [Int] = []
  /// What ✕ reports as the learner leaves from this question.
  var leaving: AnalyticsEvent?
  /// "Stop and use my answers", offered only while stopping gives a result.
  var stop: TestStop?

  var segments: TaskSegments {
    TaskSegments(
      segments: (0..<max(total, answered + 1)).map { index in
        index < answered ? .done : index == answered ? .current : .ahead
      },
      groups: groups,
      label: Text(TestCopy.question(answered + 1, of: total)))
  }
}

/// Ends the test with the answers given, from the question it was offered on.
struct TestStop: Equatable {
  /// The question it stops at.
  let id: String
  /// Said over the ways out, such as the Focus test's after many "I don't know yet".
  var hint: LocalizedStringResource?
  /// An answer is saving: stopping waits for it, while leaving doesn't.
  var waits = false
  let action: () -> Void

  static func == (lhs: Self, rhs: Self) -> Bool {
    lhs.id == rhs.id && lhs.hint == rhs.hint && lhs.waits == rhs.waits
  }
}

struct TestTopKey: PreferenceKey {
  static var defaultValue: TestTop? { nil }

  static func reduce(value: inout TestTop?, nextValue: () -> TestTop?) {
    value = nextValue() ?? value
  }
}

extension View {
  /// A test screen's bar: `.open` for its wait and result, a question's top while one shows. An
  /// open test is a task, so onboarding's plan so far leaves its side meanwhile.
  func testTop(_ top: TestTop) -> some View {
    environment(\.onboardingAside, nil)
      .preference(key: TestTopKey.self, value: top)
  }

  /// A test taken from the plan, as a task: ✕ and, while a question shows, what it tests over its
  /// segments. `name` names the screen for the system.
  func testTask(name: Text, leave: @escaping () -> Void) -> some View {
    modifier(TestTask(name: name, leave: leave))
  }
}

/// A test's ✕. Where stopping gives a result it asks first, with the two ways out: leave and come
/// back to the test, or end it with the answers given. Otherwise it leaves.
struct TestClose: View {
  let top: TestTop?
  let leave: () -> Void

  @State private var asksWayOut = false

  private var question: TestQuestionTop? { top?.question }

  var body: some View {
    Button(role: .close) {
      if question?.stop != nil {
        asksWayOut = true
      } else {
        finishLater()
      }
    }
    .leavesOnEscape()
    // On the button, so the dialog comes from it.
    .confirmationDialog(
      question?.stop?.hint.map { Text($0) }
        ?? Text("Leave", tableName: "Onboarding", comment: "Names a test's ways out behind ✕"),
      isPresented: $asksWayOut,
      titleVisibility: question?.stop?.hint == nil ? .hidden : .visible
    ) {
      Button(action: finishLater) {
        Text(TestCopy.finishLater)
      }

      if let stop = question?.stop {
        Button(action: stop.action) {
          Text(TestCopy.stopAndUseAnswers)
        }
        .disabled(stop.waits)
      }
    }
    .onChange(of: question?.stop == nil) {
      if question?.stop == nil {
        asksWayOut = false
      }
    }
  }

  private func finishLater() {
    question?.leaving.map(UsageAnalytics.track)
    leave()
  }
}

private struct TestTask: ViewModifier {
  let name: Text
  let leave: () -> Void

  @State private var top: TestTop?

  func body(content: Content) -> some View {
    let question = top?.question

    content
      .onPreferenceChange(TestTopKey.self) { top = $0 }
      .taskSegmentsBar(question?.segments)
      .taskTitle(question.map { Text(verbatim: $0.title) }, name: name)
      // The offer, the wait and the result name themselves in their body.
      .toolbar(removing: question == nil ? .title : nil)
      .taskClose { TestClose(top: top, leave: leave) }
  }
}
