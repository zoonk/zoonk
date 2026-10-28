import SwiftUI

/// A language goal's speaking practice in an exam's format at the level it aims for, from Today's
/// "Practice anytime" and the sidebar: the paper's tasks, one at a time, and their last results.
/// Each task is a call; starting one writes its card, then opens the call.
struct SpeakingScreen: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(LearnerSummaryStore.self) private var summary

  var body: some View {
    Group {
      if let goalId = summary.summary.value?.activeGoalID {
        SpeakingPaperView(goalId: goalId, paper: voice.speakingPaper(goalId: goalId))
      } else {
        ContentUnavailableView {
          Label {
            Text("Speaking practice", tableName: "Voice", comment: "Speaking practice page title")
          } icon: {
            Image(systemName: "mic")
          }
        } description: {
          Text(
            "Calls in the language you're learning, at your level.", tableName: "Voice",
            comment: "What speaking practice is, without a goal")
        }
      }
    }
    .navigationTitle(
      Text("Speaking practice", tableName: "Voice", comment: "Speaking practice page title"))
  }
}

private struct SpeakingPaperView: View {
  @Environment(VoiceServices.self) private var voice
  @Environment(AppRouter.self) private var router
  @State private var startingTask: String?
  @State private var startFailure: StartFailure?

  let goalId: String
  let paper: Resource<Components.Schemas.SpeakingPaper>

  private enum StartFailure: Equatable {
    case limit(CallLimit)
    case failed
  }

  var body: some View {
    content
      .loads(paper)
  }

  @ViewBuilder
  private var content: some View {
    switch paper.state {
    case .idle, .loading:
      ProgressView()
    case .empty, .failed(.notFound):
      ContentUnavailableView {
        Label {
          Text(
            "No speaking practice for this goal", tableName: "Voice",
            comment: "No exam format fits the goal")
        } icon: {
          Image(systemName: "mic.slash")
        }
      }
    case .failed:
      ContentUnavailableView {
        Label {
          Text("Speaking practice didn't load", tableName: "Voice", comment: "Loading failed")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } actions: {
        Button {
          Task { await paper.refresh() }
        } label: {
          Text("Try again", tableName: "Voice", comment: "Button to retry loading")
        }
        .buttonStyle(.bordered)
      }
    case .loaded(let value):
      list(value)
    }
  }

  private func list(_ paper: Components.Schemas.SpeakingPaper) -> some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          Text("Exam-style speaking", tableName: "Voice", comment: "Eyebrow over the exam's name")
            .font(.caption.monospaced())
            .foregroundStyle(.tertiary)
          Text(paper.title)
            .font(.title2.weight(.semibold))
          Text(
            "\(paper.tasks.count) tasks · \(minutesText(min: paper.minutes.min, max: paper.minutes.max)) in the exam",
            tableName: "Voice",
            comment: "How many tasks the speaking paper has and how long it is"
          )
          .font(.subheadline.monospacedDigit())
          .foregroundStyle(.secondary)
          Text(
            "\(paper.title) is an official exam. Practice its speaking tasks whether or not you plan to take it.",
            tableName: "Voice", comment: "The exam is official; practicing doesn't mean taking it"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
      }

      if paper.access == .plusRequired {
        Section {
          PlusNotice(
            description: Text(
              "Speaking practice comes with Plus: every task of the paper on a call, and an estimate on the official criteria after each one.",
              tableName: "Voice", comment: "Speaking practice needs Plus"),
            isInset: true)
        }
      } else if paper.access == .callsPaused {
        Section {
          Label {
            VStack(alignment: .leading, spacing: 2) {
              Text("Calls are paused", tableName: "Voice", comment: "Calls are off for everyone")
                .font(.headline)
              Text(
                "It's the same for everyone right now. Try again later.", tableName: "Voice",
                comment: "Calls are paused for everyone"
              )
              .font(.subheadline)
              .foregroundStyle(.secondary)
            }
          } icon: {
            Image(systemName: "phone.down")
          }
        }
      }

      Section {
        ForEach(Array(paper.tasks.enumerated()), id: \.element.key) { index, task in
          taskRow(task, index: index, paper: paper)
        }
      } header: {
        Text("Tasks", tableName: "Voice", comment: "The speaking paper's tasks")
      } footer: {
        VStack(alignment: .leading, spacing: 8) {
          if let startFailure {
            switch startFailure {
            case .limit(let limit):
              Group {
                if limit.period == .month {
                  Text(
                    "Not enough call time this month for this task", tableName: "Voice",
                    comment: "The call time left this month can't fit this task")
                } else {
                  Text(
                    "Not enough call time today for this task", tableName: "Voice",
                    comment: "The call time left today can't fit this task")
                }
              }
              .foregroundStyle(.destructive)
            case .failed:
              Text(
                "The task didn't start. Try again in a moment.", tableName: "Voice",
                comment: "Starting an exam task failed"
              )
              .foregroundStyle(.destructive)
            }
          }

          if paper.tasks.contains(where: { $0.role == .partner }) {
            Text(
              "An AI stands in for the human examiner or the other candidate. Each try has a new card, and after it you get an estimate on the exam's official criteria, not an official score.",
              tableName: "Voice", comment: "What a practice exam task with a partner is")
          } else {
            Text(
              "An AI stands in for the human examiner. Each try has a new card, and after it you get an estimate on the exam's official criteria, not an official score.",
              tableName: "Voice", comment: "What a practice exam task is")
          }

          if let source = URL(string: paper.source) {
            Link(destination: source) {
              Text(
                "Official format", tableName: "Voice", comment: "Link to the exam's official page"
              )
              .underline()
            }
          }
        }
      }
    }
  }

  private func taskRow(
    _ task: Components.Schemas.SpeakingPaperTask, index: Int,
    paper: Components.Schemas.SpeakingPaper
  ) -> some View {
    let locked = paper.access != .open

    return VStack(alignment: .leading, spacing: 8) {
      Text(
        "Task \(index + 1) · \(task.name)", tableName: "Voice",
        comment: "A speaking task's number and official name"
      )
      .font(.headline)

      Text(facts(task))
        .font(.subheadline)
        .foregroundStyle(.secondary)

      if let lastTry = task.lastTry {
        Text(lastTryText(lastTry, level: paper.level.rawValue))
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }

      HStack(spacing: 12) {
        if !locked {
          Button {
            Task { await start(task.key) }
          } label: {
            if startingTask == task.key {
              Text("Starting…", tableName: "Voice", comment: "A task is starting")
            } else {
              Text("Start this task", tableName: "Voice", comment: "Starts an exam speaking task")
            }
          }
          .buttonStyle(.mainAction)
          .disabled(startingTask != nil)
        }

        if let lastTry = task.lastTry {
          Button {
            router.open(.conversation(conversationId: lastTry.conversationId))
          } label: {
            Text("See your last result", tableName: "Voice", comment: "Opens a task's last result")
          }
          .buttonStyle(.bordered)
        }
      }
      .padding(.top, 4)
    }
    .padding(.vertical, 4)
  }

  private func facts(_ task: Components.Schemas.SpeakingPaperTask) -> String {
    let role =
      task.role == .partner
      ? String(
        localized: "With another candidate (AI)", table: "Voice",
        comment: "Whom the learner talks to")
      : String(
        localized: "With an examiner (AI)", table: "Voice", comment: "Whom the learner talks to")

    var facts = [role, minutesText(min: task.minutes.min, max: task.minutes.max)]

    if task.prepMinutes > 0 {
      facts.append(
        String(
          localized:
            "\(Duration.seconds(Int(task.prepMinutes.rounded()) * 60).formatted(.units(allowed: [.minutes], width: .abbreviated))) to prepare",
          table: "Voice", comment: "How long the exam gives to prepare"))
    }

    return facts.joined(separator: " · ")
  }

  private func minutesText(min: Double, max: Double) -> String {
    min == max
      ? String(localized: "\(Int(min)) min", table: "Voice", comment: "A task's length")
      : String(
        localized: "\(Int(min))–\(Int(max)) min", table: "Voice", comment: "A task's length range")
  }

  private func lastTryText(
    _ lastTry: Components.Schemas.SpeakingPaperTask.LastTryPayload, level: String
  ) -> String {
    if lastTry.rated == 0 {
      return String(
        localized: "Last try: no estimate", table: "Voice", comment: "A try without rating")
    }

    if lastTry.atLevel > 0 {
      return String(
        localized: "Last try: \(lastTry.atLevel) of \(lastTry.rated) at \(level)", table: "Voice",
        comment: "Criteria rated at the exam's level on the last try")
    }

    return lastTry.nearLevel > 0
      ? String(
        localized: "Last try: \(lastTry.nearLevel) of \(lastTry.rated) near \(level)",
        table: "Voice",
        comment: "Criteria rated near the exam's level on the last try")
      : String(
        localized: "Last try: below \(level)", table: "Voice",
        comment: "Every criterion below the exam's level on the last try")
  }

  /// Writes the task's card and opens its call (only on the learner's tap).
  private func start(_ task: String) async {
    startingTask = task
    startFailure = nil
    defer { startingTask = nil }

    do {
      let id = try await voice.startConversation(
        .case4(.init(goalId: goalId, kind: .examSpeaking, task: task)))
      router.open(.conversation(conversationId: id))
    } catch let refusal as VoiceRefusal {
      if case .limit(let limit) = CallReservation(refusal: refusal) {
        startFailure = .limit(limit)
      } else {
        startFailure = .failed
      }
    } catch is CancellationError {
      return
    } catch {
      startFailure = .failed
    }
  }
}

extension VoiceServices {
  /// Creates a conversation the learner tapped to start.
  func startConversation(
    _ input: Components.Schemas.LanguageConversationStartInput
  ) async throws -> String {
    let api = liveCalls
    return try await perform { token in try await api.start(input, token: token) }
  }
}
