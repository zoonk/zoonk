import SwiftUI

struct ConversationResultView: View {
  @Environment(\.dismiss) private var dismiss
  let conversation: LanguageConversation
  /// Nil for a call opened later, which shows only its own result.
  var day: DayResult?

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
    .safeAreaBar(edge: .bottom) {
      Button {
        dismiss()
      } label: {
        Text("Continue", tableName: "Voice", comment: "Leaves a call's result")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
      .keyboardShortcut(.defaultAction)
      .scenePadding()
      .keepsOffFold()
    }
  }

  private func header(_ result: Components.Schemas.LanguageConversation.ResultPayload) -> some View
  {
    Section {
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

        if conversation.speakingTask == nil, conversation.mockExam == nil {
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

      if conversation.speakingTask == nil, conversation.mockExam == nil,
        !conversation.objectives.isEmpty
      {
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
      } else if conversation.speakingTask == nil, conversation.mockExam == nil {
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
