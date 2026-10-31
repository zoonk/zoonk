import SwiftUI

struct ConversationResultView: View {
  private enum StartFailure: Equatable {
    case limit(CallLimit)
    case failed
  }

  @Environment(VoiceServices.self) private var voice
  @Environment(AppRouter.self) private var router
  @Environment(\.dismiss) private var dismiss
  @State private var isStartingAgain = false
  @State private var isWritingAgain = false
  @State private var again: Task<Void, Never>?
  @State private var startFailure: StartFailure?
  let conversation: LanguageConversation
  /// Nil for a call opened later, which shows only its own result.
  var day: DayResult?
  /// Shows the new call this result started in its place.
  let onStartedAgain: (String) -> Void

  var body: some View {
    List {
      if let result = conversation.result {
        header(result)

        switch result.feedback {
        case .call(let feedback):
          CallFeedbackSections(conversation: conversation, feedback: feedback)
        case .examSpeaking(let feedback):
          if let task = conversation.speakingTask {
            ExamSpeakingSections(
              task: task, feedback: feedback, language: conversation.targetLanguage)
          }
        case .speakingMock(let feedback):
          SpeakingMockSections(feedback: feedback)
        case nil:
          if conversation.kind == .speakingMock {
            SpeakingMockSections(feedback: nil)
          } else if let task = conversation.speakingTask {
            ExamSpeakingSections(task: task, feedback: nil, language: conversation.targetLanguage)
          }
        }
      }

      if let day {
        DayMomentSections(result: day)
      }
    }
    .milestoneCeremony(day?.ceremony)
    .onDisappear { again?.cancel() }
    .safeAreaBar(edge: .bottom) {
      VStack(spacing: 8) {
        if let startFailure {
          startFailureText(startFailure)
            .font(.subheadline)
            .foregroundStyle(.destructive)
        }

        mainAction

        if isWritingAgain {
          writingAgain
        } else if let input = againInput {
          Button {
            again = Task { await startAgain(input) }
          } label: {
            if conversation.kind == .speakingMock {
              Text("Try another mock", tableName: "Voice", comment: "Starts a new speaking mock")
            } else {
              Text(
                "Try this task with a new card", tableName: "Voice",
                comment: "Starts the same exam task again with a new card")
            }
          }
          .buttonStyle(.borderless)
          .disabled(isStartingAgain)
        }
      }
      .scenePadding()
      .keepsOffFold()
    }
  }

  @ViewBuilder
  private var writingAgain: some View {
    if conversation.kind == .speakingMock {
      WritingWait(
        title: Text(
          "Writing your mock", tableName: "Voice", comment: "A speaking mock is being written"),
        hint: Text(
          "Your mock opens as soon as it's ready.", tableName: "Voice",
          comment: "A speaking mock opens by itself once it's written"))
    } else {
      WritingWait(
        title: Text(
          "Writing your task", tableName: "Voice", comment: "An exam task's card is being written"),
        hint: Text(
          "Your task opens as soon as its card is ready.", tableName: "Voice",
          comment: "An exam task opens by itself once its card is written"))
    }
  }

  /// The paper's next task when this one stands alone: a mock's tasks go back to the mock.
  private var nextTask: (key: String, number: Int)? {
    guard let task = conversation.speakingTask, task.sectionId == nil, let next = task.nextTask
    else {
      return nil
    }

    return (next, task.number + 1)
  }

  /// A speaking mock, or an exam task outside a mock, starts again with a new card.
  private var againInput: Components.Schemas.LanguageConversationStartInput? {
    guard let goalId = conversation.goalId else {
      return nil
    }

    if conversation.kind == .speakingMock {
      return .case3(.init(goalId: goalId, kind: .speakingMock))
    }

    if let task = conversation.speakingTask, task.sectionId == nil {
      return .case4(.init(goalId: goalId, kind: .examSpeaking, task: task.task.key))
    }

    return nil
  }

  private var mainAction: some View {
    Button {
      if let nextTask {
        router.speakingTask = nextTask.key
        router.open(.speaking)
      } else {
        dismiss()
      }
    } label: {
      Group {
        if let nextTask {
          Text(
            "Go to task \(nextTask.number)", tableName: "Voice",
            comment: "Opens the speaking paper's next task")
        } else {
          Text("Continue", tableName: "Voice", comment: "Leaves a call's result")
        }
      }
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(.mainAction)
    .controlSize(.large)
    .keyboardShortcut(.defaultAction)
  }

  @ViewBuilder
  private func startFailureText(_ failure: StartFailure) -> some View {
    let isMock = conversation.kind == .speakingMock

    switch failure {
    case .limit(let limit) where limit.period == .month:
      if isMock {
        Text(
          "Not enough call time this month for this mock", tableName: "Voice",
          comment: "The call time left this month can't fit the mock")
      } else {
        Text(
          "Not enough call time this month for this task", tableName: "Voice",
          comment: "The call time left this month can't fit this task")
      }
    case .limit:
      if isMock {
        Text(
          "Not enough call time today for this mock", tableName: "Voice",
          comment: "The call time left today can't fit the mock")
      } else {
        Text(
          "Not enough call time today for this task", tableName: "Voice",
          comment: "The call time left today can't fit this task")
      }
    case .failed:
      if isMock {
        Text(
          "The mock didn't start. Try again in a moment.", tableName: "Voice",
          comment: "Starting the speaking mock failed")
      } else {
        Text(
          "The task didn't start. Try again in a moment.", tableName: "Voice",
          comment: "Starting an exam task failed")
      }
    }
  }

  /// Only on the learner's tap.
  private func startAgain(_ input: Components.Schemas.LanguageConversationStartInput) async {
    isStartingAgain = true
    startFailure = nil
    defer {
      isStartingAgain = false
      isWritingAgain = false
    }

    switch await voice.startConversation(input, whileWriting: { isWritingAgain = true }) {
    case .done(.done(let id)):
      onStartedAgain(id)
    case .done(.refused(let refusal)):
      if case .limit(let limit) = CallReservation(refusal: refusal) {
        startFailure = .limit(limit)
      } else {
        startFailure = .failed
      }
    case .failed:
      startFailure = .failed
    case .obsolete:
      break
    }
  }

  /// An exam task or speaking mock is rated on its exam's criteria instead.
  private var showsStars: Bool {
    conversation.speakingTask == nil && conversation.mockExam == nil
  }

  private func header(_ result: Components.Schemas.LanguageConversation.ResultPayload) -> some View
  {
    Section {
      if conversation.kind == .checkpoint || showsStars {
        VStack(alignment: .leading, spacing: 12) {
          if conversation.kind == .checkpoint {
            Group {
              if result.passed {
                Text("Challenge passed", tableName: "Voice", comment: "A checkpoint call passed")
              } else {
                Text("Not this time", tableName: "Voice", comment: "A checkpoint call not passed")
              }
            }
            .font(.title2.weight(.semibold))
          }

          if showsStars {
            HStack(spacing: 4) {
              ForEach(0..<3, id: \.self) { index in
                Image(systemName: index < result.stars ? "star.fill" : "star")
                  .foregroundStyle(
                    index < result.stars ? AnyShapeStyle(.energy) : AnyShapeStyle(.tertiary))
              }
            }
            .font(.title2)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(
              Text("\(result.stars) of 3 stars", tableName: "Voice", comment: "A call's stars"))
          }
        }
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
      }

      if showsStars, !conversation.objectives.isEmpty {
        LabeledContent {
          Text(
            "\(conversation.objectives.filter(\.met).count) of \(conversation.objectives.count)",
            tableName: "Voice", comment: "Goals met out of all"
          )
          .monospacedDigit()
        } label: {
          Text("Goals", tableName: "Voice", comment: "Readout label for the call's goals")
        }
      }

      // Never "0": a call that earned nothing doesn't list it, as on main.
      if result.brainPower > 0 {
        LabeledContent {
          Text(result.brainPower, format: .number.sign(strategy: .always()))
            .monospacedDigit()
            .foregroundStyle(.brain)
        } label: {
          Label {
            Text("Brain Power", tableName: "Voice", comment: "Points earned label")
          } icon: {
            Image(systemName: "brain.head.profile")
              .foregroundStyle(.brain)
              .accessibilityHidden(true)
          }
        }
      }
    } footer: {
      if conversation.kind == .checkpoint, !result.passed {
        Text(
          "Nothing is lost: the call comes back so you can try again.", tableName: "Voice",
          comment: "A checkpoint call that didn't pass")
      } else if showsStars {
        Text(
          "A star for finishing, one for getting everything across and one without Help.",
          tableName: "Voice", comment: "How a call's stars are earned")
      }
    }
  }
}

private struct CallFeedbackSections: View {
  let conversation: LanguageConversation
  let feedback: Components.Schemas.LanguageCallFeedback

  var body: some View {
    let language = conversation.targetLanguage
    let met = conversation.objectives.filter(\.met)
    let missed = conversation.objectives.filter { !$0.met }

    Section {
      Text(feedback.encouragement)

      ForEach(met, id: \.label) { objective in
        Label {
          Text(objective.label).typesettingLanguage(.init(identifier: language))
        } icon: {
          Image(systemName: "checkmark.circle.fill").foregroundStyle(.success)
        }
      }

      ForEach(feedback.wentWell, id: \.self) { phrase in
        Text(phrase)
          .fontWeight(.medium)
          .typesettingLanguage(.init(identifier: language))
      }
    } header: {
      Text("What went well", tableName: "Voice", comment: "A call result's first part")
    }

    if feedback.improve != nil || !missed.isEmpty || !feedback.pronunciation.isEmpty {
      Section {
        if let improve = feedback.improve {
          VStack(alignment: .leading, spacing: 8) {
            LabeledContent {
              Text(improve.said).typesettingLanguage(.init(identifier: language))
            } label: {
              Text("You said", tableName: "Voice", comment: "What the learner said in the call")
            }

            HStack(alignment: .firstTextBaseline) {
              LabeledContent {
                Text(improve.better)
                  .fontWeight(.medium)
                  .typesettingLanguage(.init(identifier: language))
              } label: {
                Text("Better", tableName: "Voice", comment: "A better way to say it")
              }

              SpeakButton(sound: .text(improve.better, language: language, personal: true))
            }

            Text(improve.why)
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
          .labeledContentStyle(.vertical)
        }

        ForEach(missed, id: \.label) { objective in
          Label {
            Text(objective.label).typesettingLanguage(.init(identifier: language))
          } icon: {
            Image(systemName: "circle").foregroundStyle(.tertiary)
          }
        }

        ForEach(feedback.pronunciation, id: \.word) { item in
          HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
              Text(item.word)
                .fontWeight(.medium)
                .typesettingLanguage(.init(identifier: language))
              Text(item.respelling)
                .font(.subheadline.monospaced())
                .foregroundStyle(.secondary)
              Text(item.tip)
                .font(.footnote)
                .foregroundStyle(.secondary)
            }

            Spacer()

            SpeakButton(sound: .text(item.word, language: language))
          }
        }
      } header: {
        Text("To improve", tableName: "Voice", comment: "A call result's second part")
      }
    }
  }
}

struct SpeakButton: View {
  @Environment(VoiceServices.self) private var voice
  @State private var owner = UUID()

  let sound: SpokenSound

  var body: some View {
    let state = voice.player.state(for: owner)

    Button {
      if state == .loading || state == .playing {
        voice.player.stop(owner: owner)
      } else {
        Task { await voice.player.play(sound, owner: owner) }
      }
    } label: {
      Label {
        Text("Listen", tableName: "Voice", comment: "Plays a phrase aloud")
      } icon: {
        switch state {
        case .loading:
          ProgressView().controlSize(.mini)
        case .playing:
          Image(systemName: "stop.fill")
        case .failed:
          Image(systemName: "speaker.slash")
        case .idle:
          Image(systemName: "speaker.wave.2")
        }
      }
      .labelStyle(.iconOnly)
    }
    .buttonStyle(.bordered)
    .onDisappear { voice.player.stop(owner: owner) }
  }
}

extension LabeledContentStyle where Self == VerticalLabeledContentStyle {
  fileprivate static var vertical: VerticalLabeledContentStyle { VerticalLabeledContentStyle() }
}

private struct VerticalLabeledContentStyle: LabeledContentStyle {
  func makeBody(configuration: Configuration) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      configuration.label
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
      configuration.content
    }
  }
}
