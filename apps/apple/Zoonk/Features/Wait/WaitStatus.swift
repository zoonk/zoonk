import SwiftUI

/// Main's `WaitStatus`: what the wait is building, as one strip over the quiz. Tapping it pushes the
/// work's progress. `share` is the progress at a moment, from 0 to 1; `firstLesson` is what else is
/// written alongside, a learn goal's lesson 1.
struct WaitStatusStrip: View {
  let label: Text
  let isDone: Bool
  let share: (Date) -> Double
  var firstLesson: GenerationWait.FirstLesson?

  @Environment(WaitVisit.self) private var visit
  @ScaledMetric(relativeTo: .subheadline) private var markWidth = 16.0
  @ScaledMetric(relativeTo: .subheadline) private var lineHeight = 20.0

  var body: some View {
    Button {
      visit.openProgress()
    } label: {
      TimelineView(.animation(minimumInterval: 1, paused: isDone)) { context in
        let shown = isDone ? 1 : share(context.date)

        VStack(alignment: .leading, spacing: 2) {
          HStack(alignment: .top, spacing: 12) {
            WaitMark(isDone: isDone, share: shown)
              .frame(width: markWidth, height: lineHeight)

            label
              .typeStyle(.rowTitle)
              .foregroundStyle(Color(.foreground))
              .frame(maxWidth: .infinity, minHeight: lineHeight, alignment: .leading)

            DisclosureChevron()
              .frame(height: lineHeight)
          }

          if let firstLesson {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
              Image(systemName: "checkmark")
                .typeStyle(.note.weight(.semibold))
                .foregroundStyle(.success)
                .opacity(firstLesson.isReady ? 1 : 0)
                .frame(width: markWidth)
                .accessibilityHidden(true)

              FirstLessonLine(lesson: firstLesson)
            }
          }
        }
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .accessibilityValue(Text(shown, format: .percent.precision(.fractionLength(0))))
      }
    }
    .buttonStyle(.plain)
  }
}

/// The ring closes into a check as the work finishes; both stay drawn so one fades into the other.
private struct WaitMark: View {
  let isDone: Bool
  let share: Double

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @ScaledMetric(relativeTo: .subheadline) private var size = 16.0

  var body: some View {
    ZStack {
      GoalRing(share: share, size: size) {}
        .opacity(isDone ? 0 : 1)

      Image(systemName: "checkmark")
        .typeStyle(.body.weight(.semibold))
        .foregroundStyle(.success)
        .opacity(isDone ? 1 : 0)
    }
    .animation(reduceMotion ? nil : .easeOut(duration: 0.2), value: isDone)
    .accessibilityHidden(true)
  }
}

/// Lesson 1's line under the strip, for a goal whose first lesson is written before its plan.
private struct FirstLessonLine: View {
  let lesson: GenerationWait.FirstLesson

  var body: some View {
    Group {
      if lesson.isReady {
        Text(
          "Your first lesson is ready", tableName: "Onboarding",
          comment: "Under the plan's status while it's built: the goal's first lesson can start")
      } else {
        Text(
          "Writing your first lesson: \(Text(lesson.title).foregroundStyle(Color(.foreground)))",
          tableName: "Onboarding",
          comment:
            "Under the plan's status while it's built: the goal's first lesson is being written. The argument is the lesson's title."
        )
      }
    }
    .typeStyle(.note)
    .foregroundStyle(.mutedForeground)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// Main's `FirstLessonRow`: lesson 1 in the progress view, below the plan's steps, since it's written
/// alongside the plan.
struct FirstLessonSection: View {
  let lesson: GenerationWait.FirstLesson
  let clockOffset: TimeInterval?

  @ScaledMetric(relativeTo: .subheadline) private var markWidth = 16.0
  @ScaledMetric(relativeTo: .subheadline) private var lineHeight = 20.0

  var body: some View {
    Section {
      TimelineView(.periodic(from: .now, by: 1)) { context in
        HStack(alignment: .top, spacing: 12) {
          WaitMark(isDone: lesson.isReady, share: share(at: context.date))
            .frame(width: markWidth, height: lineHeight)

          VStack(alignment: .leading, spacing: 2) {
            Text(lesson.title)
              .typeStyle(.rowTitle)
              .frame(minHeight: lineHeight)

            Group {
              if lesson.isDone {
                Text("Done", tableName: "Onboarding", comment: "A finished step of a wait")
              } else if lesson.isReady {
                Text(
                  "Ready to start", tableName: "Onboarding",
                  comment: "Under the goal's first lesson once it's written")
              } else {
                Text(
                  "Writing about 5 short screens", tableName: "Onboarding",
                  comment: "Under the goal's first lesson while it's written")
              }
            }
            .typeStyle(.meta)
            .foregroundStyle(.mutedForeground)
          }
          .frame(maxWidth: .infinity, alignment: .leading)

          if let seconds = seconds(at: context.date) {
            Text(GenerationClock.text(seconds))
              .typeStyle(.data)
              .foregroundStyle(.mutedForeground)
              .frame(minHeight: lineHeight)
              .accessibilityHidden(true)
          }
        }
        .accessibilityElement(children: .combine)
      }
    } header: {
      SectionTitle(
        Text(
          "Your first lesson", tableName: "Onboarding",
          comment: "Header over the goal's first lesson in the plan's progress"))
    }
  }

  private var startedAt: Date? {
    lesson.startedAt.map { $0 + (clockOffset ?? 0) }
  }

  private func seconds(at date: Date) -> TimeInterval? {
    guard let startedAt else {
      return nil
    }

    let end = lesson.isReady ? lesson.endedAt.map { $0 + (clockOffset ?? 0) } : date
    return end.map { max(0, $0.timeIntervalSince(startedAt)) }
  }

  /// Main's lesson mark: it drifts toward almost done over a lesson's usual time.
  private func share(at date: Date) -> Double {
    guard let seconds = seconds(at: date) else {
      return 0
    }

    return 0.95 * (1 - exp(-seconds / (GenerationWait.lessonSeconds / 2)))
  }
}
