import SwiftUI

/// A finished call's result: its stars, goals and Brain Power, what went well and what to improve
/// (a better way to say something, words to practice saying, each one playable); an exam task or a
/// speaking mock rates each criterion with the evidence and a tip instead.
struct ConversationResultView: View {
  @Environment(\.dismiss) private var dismiss
  let conversation: LanguageConversation

  var body: some View {
    List {
      if let result = conversation.result {
        header(result)

        switch result.feedback {
        case .call(let feedback):
          CallFeedbackSections(conversation: conversation, feedback: feedback)
        case .examSpeaking(let feedback):
          CriteriaSection(
            criteria: feedback.criteria.map {
              .init(
                name: criterionName($0.criterion), bandLow: $0.bandLow, bandHigh: $0.bandHigh,
                evidence: $0.evidence, tip: $0.tip)
            },
            focus: criterionName(feedback.focus))
        case .speakingMock(let mock):
          speakingMock(mock)
        case nil:
          EmptyView()
        }
      }
    }
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

      if conversation.speakingTask == nil, conversation.mockExam == nil {
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

      LabeledContent {
        Text(result.brainPower, format: .number)
          .monospacedDigit()
          .foregroundStyle(.brain)
      } label: {
        Label {
          Text("Brain Power", tableName: "Voice", comment: "Points earned label")
        } icon: {
          Image(systemName: "brain.head.profile")
            .foregroundStyle(.brain)
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

  @ViewBuilder
  private func speakingMock(_ mock: Components.Schemas.LanguageSpeakingMockFeedback) -> some View {
    switch mock {
    case .ielts(let feedback):
      CriteriaSection(
        overall: (feedback.overall.bandLow, feedback.overall.bandHigh),
        criteria: feedback.criteria.map {
          .init(
            name: criterionName($0.criterion.rawValue), bandLow: $0.bandLow, bandHigh: $0.bandHigh,
            evidence: $0.evidence, tip: $0.tip)
        },
        focus: criterionName(feedback.focus.rawValue))
    case .toefl(let feedback):
      CriteriaSection(
        overall: (feedback.overall.bandLow, feedback.overall.bandHigh),
        criteria: feedback.criteria.map {
          .init(
            name: criterionName($0.criterion.rawValue), bandLow: $0.bandLow, bandHigh: $0.bandHigh,
            evidence: $0.evidence, tip: $0.tip)
        },
        focus: criterionName(feedback.focus.rawValue))
    }
  }

  /// A criterion's name: an exam task's official one, or the speaking mocks' as learners read them.
  private func criterionName(_ key: String) -> String {
    if let criterion = conversation.speakingTask?.criteria.first(where: { $0.key == key }) {
      return criterion.name
    }

    return switch key {
    case "delivery":
      String(localized: "Pace and pronunciation", table: "Voice", comment: "A speaking criterion")
    case "elaboration":
      String(localized: "Clear, developed answers", table: "Voice", comment: "A speaking criterion")
    case "fluencyCoherence":
      String(localized: "Fluency and coherence", table: "Voice", comment: "A speaking criterion")
    case "grammar":
      String(localized: "Grammar", table: "Voice", comment: "A speaking criterion")
    case "lexicalResource", "vocabulary":
      String(localized: "Vocabulary", table: "Voice", comment: "A speaking criterion")
    case "pronunciation":
      String(localized: "Pronunciation", table: "Voice", comment: "A speaking criterion")
    case "repetition":
      String(localized: "Repeating sentences", table: "Voice", comment: "A speaking criterion")
    default:
      key
    }
  }
}

/// A practice call's or checkpoint's feedback: what went well, then what to improve.
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

/// An exam task's or a speaking mock's rating: each criterion's band range, the evidence and a tip.
private struct CriteriaSection: View {
  struct Criterion {
    let name: String
    let bandLow: Double
    let bandHigh: Double
    let evidence: String
    let tip: String
  }

  var overall: (Double, Double)?
  let criteria: [Criterion]
  let focus: String

  var body: some View {
    if let overall {
      Section {
        LabeledContent {
          Text(band(overall.0, overall.1))
            .font(.title2.weight(.semibold).monospacedDigit())
        } label: {
          Text("Overall band", tableName: "Voice", comment: "A speaking mock's overall estimate")
        }
      }
    }

    Section {
      ForEach(criteria, id: \.name) { criterion in
        VStack(alignment: .leading, spacing: 4) {
          LabeledContent(criterion.name) {
            Text(band(criterion.bandLow, criterion.bandHigh))
              .monospacedDigit()
          }
          .font(.headline)

          Text(criterion.evidence)
            .font(.subheadline)
          Label {
            Text(criterion.tip)
          } icon: {
            Image(systemName: "lightbulb")
          }
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
      }
    } header: {
      Text("How you did", tableName: "Voice", comment: "A speaking rating's criteria")
    } footer: {
      Text("Work on next: \(focus)", tableName: "Voice", comment: "The criterion to focus on")
    }
  }

  private func band(_ low: Double, _ high: Double) -> String {
    low == high
      ? low.formatted(.number.precision(.fractionLength(0...1)))
      : "\(low.formatted(.number.precision(.fractionLength(0...1))))–\(high.formatted(.number.precision(.fractionLength(0...1))))"
  }
}

/// Plays a phrase read aloud in its language; the phrase stays on screen if the sound fails.
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
  /// The label over its content, for longer phrases.
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
