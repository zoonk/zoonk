import SwiftUI

/// The device keeps when preparation started for each card, so leaving and coming back keeps the
/// clock going, as main's does.
struct ExamPrepTimer: View {
  private static let staleAfter: TimeInterval = 6 * 60 * 60

  @AppStorage private var startedAt: Double
  let task: Components.Schemas.SpeakingTask

  init(cardId: String, task: Components.Schemas.SpeakingTask) {
    _startedAt = AppStorage(wrappedValue: 0, "exam-prep:\(cardId)")
    self.task = task
  }

  private var start: Date? {
    let date = Date(timeIntervalSince1970: startedAt)
    return startedAt > 0 && Date.now.timeIntervalSince(date) < Self.staleAfter ? date : nil
  }

  var body: some View {
    Section {
      HStack(alignment: .center, spacing: 16) {
        VStack(alignment: .leading, spacing: 4) {
          Text("Preparation", tableName: "Voice", comment: "An exam task's preparation time")
            .font(.headline)

          if let start {
            clock(from: start)
          } else {
            Text(prepLine)
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        if start == nil {
          Button {
            startedAt = Date.now.timeIntervalSince1970
          } label: {
            Text("Start preparing", tableName: "Voice", comment: "Starts the preparation clock")
          }
          .buttonStyle(.bordered)
        } else {
          Button {
            startedAt = Date.now.timeIntervalSince1970
          } label: {
            Text("Start again", tableName: "Voice", comment: "Restarts the preparation clock")
          }
          .buttonStyle(.borderless)
        }
      }
    }
  }

  private func clock(from start: Date) -> some View {
    let deadline = start.addingTimeInterval(task.prepMinutes * 60)

    return TimelineView(.explicit([deadline])) { context in
      if context.date >= deadline {
        Text(
          "Preparation time is over. Start the call when you're ready.", tableName: "Voice",
          comment: "The preparation clock ran out"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      } else {
        Text(timerInterval: start...deadline, countsDown: true)
          .font(.title2.weight(.semibold).monospacedDigit())
          .accessibilityAddTraits(.updatesFrequently)
      }
    }
  }

  private var prepLine: String {
    let time = Self.duration(minutes: task.prepMinutes)

    guard let shared = task.prepShared else {
      return String(
        localized: "The exam gives \(time) to prepare with the card.", table: "Voice",
        comment: "How long the exam gives to prepare this task")
    }

    return String(
      localized:
        "The exam gives \(Self.duration(minutes: shared.minutes)) to prepare tasks \(shared.tasks.map(String.init).formatted(.list(type: .and))) together, about \(time) for this one.",
      table: "Voice", comment: "Preparation time several exam tasks share, and this task's part")
  }

  private static func duration(minutes: Double) -> String {
    Duration.seconds((minutes * 60).rounded())
      .formatted(.units(allowed: [.minutes, .seconds], width: .wide))
  }
}
