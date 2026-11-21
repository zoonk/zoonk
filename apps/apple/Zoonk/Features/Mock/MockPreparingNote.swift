import SwiftUI

/// Main's `MockPreparingNote`: a mock being prepared, over the buttons where Start goes. It follows
/// the run writing the learner's paper, its bar and about how long is left; with nothing writing it
/// (what was written fell short, or the run stopped), the daily preparation goes on with it, so the
/// note says to come back.
struct MockPreparingNote: View {
  let title: LocalizedStringResource
  /// Nil when it can't be read, which counts as a run still starting.
  let read: () async -> MockWriting?
  /// The run says the paper is written: the screen reads itself again, which then offers Start.
  let written: () async -> Bool

  @State private var isIdle = false

  var body: some View {
    if isIdle {
      ComeBackWords(title: title)
    } else {
      GenerationFollower(
        generationID: nil, kind: .mockPaper,
        readGenerationID: {
          let writing = await read()
          isIdle = writing?.status == MockWriting.Status.none
          return writing?.generationId
        },
        restart: { nil },
        readResult: written,
        content: { run in
          if run.failure == nil {
            MockWritingProgress(title: title, wait: run.wait)
          } else {
            ComeBackWords(title: title)
          }
        }
      )
    }
  }
}

private struct ComeBackWords: View {
  let title: LocalizedStringResource

  var body: some View {
    GateWords(title: Text(title), line: Text(MockPreparing.line))
  }
}

private struct MockWritingProgress: View {
  let title: LocalizedStringResource
  let wait: GenerationWait

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(title)
        .typeStyle(.rowTitle)
        .foregroundStyle(Color(.foreground))

      GenerationWaitBar(wait: wait)

      TimelineView(.periodic(from: .now, by: 1)) { context in
        Text(line(at: context.date))
          .typeStyle(.body)
          .foregroundStyle(.mutedForeground)
      }
    }
    .fixedSize(horizontal: false, vertical: true)
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  /// The step it's on and about how long is left, from the phases' usual durations as the bar is.
  private func line(at date: Date) -> String {
    guard !wait.isDone else {
      // The Mock table's "Done" is a speaking task's.
      return String(
        localized: "mockWritingDone", defaultValue: "Done", table: "Mock",
        comment: "The wait for a mock exam's questions is over: they're written.")
    }

    let shown = wait.visiblePhases
    let step = shown.first { $0.state == .working }.map { String(localized: $0.label) }
    let seconds = shown.reduce(0) { $0 + $1.seconds } * (1 - wait.shownShare(at: date))
    let time = MockLabels.duration(minutes: max(1, Int((seconds / 60).rounded(.up))))
    let left = String(localized: "About \(time) left", table: "Mock")

    return [step, left].compactMap(\.self).joinedFacts()
  }
}
