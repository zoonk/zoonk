import SwiftUI

/// Counted once at the end. Mistakes that were only typos get a kind note and nothing to practice.
struct PatternScreen: View {
  let patternId: String

  @Environment(SessionStore.self) private var session
  @Environment(PracticeStore.self) private var practice
  @Environment(\.practiceHooks) private var hooks
  @Environment(\.dismiss) private var dismiss
  @State private var load: PracticeLoad<Components.Schemas.MistakePattern> = .loading
  @State private var step: Step = .intro
  @State private var picks: [String] = []
  @State private var draft: PracticeAnswer?
  @State private var checked: Int?
  @State private var isSaving = false
  @State private var saveFailed = false
  @State private var showsRule = false
  @State private var ceremonyClosed = false
  /// One id for this drill, sent again by Try again, so a retry after a lost response counts once.
  @State private var requestId = UUID().uuidString.lowercased()

  private enum Step: Equatable {
    case intro
    case question(Int)
    case result(Components.Schemas.MistakePatternPracticeResult)
  }

  var body: some View {
    NavigationStack {
      Group {
        switch load {
        case .loading:
          ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let error):
          PracticeLoadFailureView(error: error) { Task { await read() } }
        case .loaded(let pattern):
          content(pattern)
        }
      }
      .navigationBarTitleDisplayMode(.inline)
      .taskClose {
        PracticeCloseButton { dismiss() }
      }
    }
    .task(id: session.authenticatedSession) { await read() }
  }

  @ViewBuilder
  private func content(_ pattern: Components.Schemas.MistakePattern) -> some View {
    if pattern.kind == .typos || pattern.drill.isEmpty {
      PracticeTaskLayout {
        VStack(alignment: .leading, spacing: 8) {
          Text(
            "Mistake pattern", tableName: "Practice",
            comment: "Eyebrow over a noticed mistake pattern."
          )
          .font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
          Text(
            "Just typos", tableName: "Practice",
            comment: "Title when recent mistakes were only typos."
          )
          .font(.largeTitle.bold())
          Text(
            "Your recent mistakes were slips while typing, not a rule you're missing. There's nothing to practice.",
            tableName: "Practice", comment: "Why a typos pattern has nothing to practice."
          )
          .foregroundStyle(.secondary)
        }
      } actions: {
        doneButton
      }
      .navigationTitle(
        Text(
          "Mistake pattern", tableName: "Practice", comment: "Title of a mistake pattern screen.")
      )
      // Read once, it steps aside: a typos note never needs to come back.
      .task { await dismissTypos() }
    } else {
      switch step {
      case .intro:
        PracticeTaskLayout {
          PatternIntroView(pattern: pattern)
        } actions: {
          PracticeMainButton(
            title: LocalizedStringResource(
              "Practice this · \(Duration.seconds(180).formatted(.units(allowed: [.minutes], width: .abbreviated)))",
              table: "Practice",
              comment: "Starts a mistake pattern's drill, with how long it takes.")
          ) {
            step = .question(0)
          }
        }
        .navigationTitle(
          Text(
            "Mistake pattern", tableName: "Practice", comment: "Title of a mistake pattern screen.")
        )
      case .question(let index):
        drillQuestion(pattern, index: index)
      case .result(let result):
        if let milestone = result.ceremony?.value1, !ceremonyClosed, let ceremony = hooks.ceremony {
          ceremony(milestone) { ceremonyClosed = true }
        } else {
          PracticeTaskLayout {
            PracticeResultHeader(
              title: LocalizedStringResource(
                "Practice done", table: "Practice", comment: "End of a practice run."),
              detail: result.correct == result.total
                ? LocalizedStringResource(
                  "You've got this rule.", table: "Practice",
                  comment: "End of a pattern drill, all right.")
                : LocalizedStringResource(
                  "Knowing the rule is the first step. It gets easier each time you use it.",
                  table: "Practice",
                  comment: "End of a pattern drill with misses."),
              correct: result.correct, total: result.total, brainPower: result.brainPower,
              reached: PracticeReached(
                energy: result.reached.energy,
                level: result.reached.level.map { .init(color: $0.color.rawValue, level: $0.level) }
              ))
          } actions: {
            doneButton
          }
          .navigationTitle(Text(pattern.title))
        }
      }
    }
  }

  private func drillQuestion(_ pattern: Components.Schemas.MistakePattern, index: Int) -> some View
  {
    let item = pattern.drill[index]
    let question = PracticeQuestion(
      itemId: "pattern-drill-\(index)", format: .multipleChoice, question: item.sentence,
      options: item.options)
    let isLast = index + 1 == pattern.drill.count
    let result: PracticeItemResult? = checked.map { picked in
      PracticeItemResult(
        answer: .choice(picked),
        correctAnswer: item.options.firstIndex(of: item.answer).map(PracticeAnswer.choice),
        isCorrect: item.options[picked].trimmingCharacters(in: .whitespaces)
          == item.answer.trimmingCharacters(in: .whitespaces))
    }

    let asked = PracticeQuestionView(
      question: question, labels: .trueFalse, result: result, draft: $draft)

    return PracticeTaskLayout(segments: segments(pattern, index: index), index: index) {
      asked.stimulus
    } response: {
      asked.response

      if let result {
        PracticeFeedbackPanel(
          verdict: PracticeVerdict(isCorrect: result.isCorrect), explanation: item.feedback)
      }
    } actions: {
      if saveFailed {
        PracticeSaveError { Task { await save(pattern) } }
      }

      if result != nil {
        PracticeMainButton(
          title: isLast
            ? LocalizedStringResource(
              "See how you did", table: "Practice",
              comment: "Ends a pattern drill to see its result.")
            : LocalizedStringResource(
              "Continue", table: "Practice", comment: "Moves on after a grade."),
          isBusy: isSaving
        ) {
          if isLast {
            Task { await save(pattern) }
          } else {
            checked = nil
            draft = nil
            step = .question(index + 1)
          }
        }
      } else {
        PracticeMainButton(
          title: LocalizedStringResource(
            "Check", table: "Practice", comment: "Sends the answer to be graded."),
          isDisabled: draft == nil
        ) {
          guard case .choice(let picked) = draft else { return }
          checked = picked
          picks.append(item.options[picked])
        }
      }
    }
    .navigationTitle(
      Text("Mistake pattern", tableName: "Practice", comment: "Title of a mistake pattern screen.")
    )
    .toolbar {
      ToolbarItem(placement: .primaryAction) {
        Button {
          showsRule = true
        } label: {
          Text(
            "See the rule", tableName: "Practice",
            comment: "Opens a pattern's rule during its drill.")
        }
      }
    }
    .sheet(isPresented: $showsRule) {
      NavigationStack {
        ScrollView {
          PatternRuleView(pattern: pattern).scenePadding()
        }
        .navigationTitle(
          Text("The rule", tableName: "Practice", comment: "Title of a pattern's rule.")
        )
        .navigationBarTitleDisplayMode(.inline)
      }
      .presentationDetents([.medium, .large])
    }
  }

  private func segments(_ pattern: Components.Schemas.MistakePattern, index: Int)
    -> [PracticeSegment]
  {
    pattern.drill.indices.map { position in
      guard position < picks.count else { return position == index ? .current : .ahead }
      return picks[position].trimmingCharacters(in: .whitespaces)
        == pattern.drill[position].answer.trimmingCharacters(in: .whitespaces) ? .right : .wrong
    }
  }

  private var doneButton: some View {
    PracticeMainButton(
      title: LocalizedStringResource(
        "Done", table: "Practice", comment: "Leaves a finished screen.")
    ) {
      dismiss()
    }
  }

  private func read() async {
    guard let identity = session.authenticatedSession else { return }

    do {
      let pattern = try await practice.api.pattern(
        token: identity.bearerToken, patternId: patternId)
      guard session.authenticatedSession == identity else { return }
      load = .loaded(pattern)
    } catch let error as APIError {
      if error == .unauthorized { await session.expire(identity) }
      load = .failed(error)
    } catch {
      load = .failed(.unavailable)
    }
  }

  private func dismissTypos() async {
    _ = await practice.write(.patternDone) { identity in
      try await practice.api.dismissPattern(token: identity.bearerToken, patternId: patternId)
    }
  }

  private func save(_ pattern: Components.Schemas.MistakePattern) async {
    isSaving = true
    saveFailed = false
    defer { isSaving = false }

    let answers = picks
    let requestId = requestId

    switch await practice.write(
      .patternDone,
      { identity in
        try await practice.api.practicePattern(
          token: identity.bearerToken, patternId: patternId, answers: answers, requestId: requestId)
      })
    {
    case .done(let result): step = .result(result)
    case .refused, .failed: saveFailed = true
    case .obsolete: break
    }
  }

}

private struct PatternIntroView: View {
  let pattern: Components.Schemas.MistakePattern

  var body: some View {
    VStack(alignment: .leading, spacing: 24) {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "We noticed a pattern", tableName: "Practice",
          comment: "Eyebrow over a noticed mistake pattern."
        )
        .font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
        Text(pattern.title).font(.largeTitle.bold())
        Text(
          "It came up \(pattern.occurrences) times in your recent answers.", tableName: "Practice",
          comment: "How often a mistake pattern came up."
        )
        .foregroundStyle(.secondary)
      }

      PatternRuleView(pattern: pattern)

      if pattern.examples.count > 1 {
        VStack(alignment: .leading, spacing: 8) {
          Text(
            "Also came up in", tableName: "Practice",
            comment: "Heading over the other answers a pattern came up in."
          )
          .font(.headline)
          ForEach(Array(pattern.examples.dropFirst().enumerated()), id: \.offset) { _, example in
            Text("“\(example.answer)”").foregroundStyle(.secondary)
          }
        }
      }
    }
  }
}

private struct PatternRuleView: View {
  let pattern: Components.Schemas.MistakePattern

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      if let example = pattern.examples.first {
        VStack(alignment: .leading, spacing: 6) {
          Label {
            Text(example.answer).strikethrough()
          } icon: {
            Text(
              "You said", tableName: "Practice",
              comment: "Label of the learner's slip in a pattern.")
          }
          .foregroundStyle(.destructive)

          Label {
            Text(example.correctAnswer)
          } icon: {
            Text(
              "Correct version", tableName: "Practice",
              comment: "Label of the corrected sentence in a pattern.")
          }
          .foregroundStyle(.success)
        }
        .labelStyle(PatternChangeLabelStyle())
        .font(.callout)
      }

      ItemText(pattern.rule)

      if !pattern.contrast.isEmpty {
        VStack(alignment: .leading, spacing: 0) {
          ForEach(Array(pattern.contrast.enumerated()), id: \.offset) { index, row in
            if index > 0 { Divider() }
            HStack(alignment: .firstTextBaseline) {
              Text(row.label).font(.subheadline.weight(.medium))
              Spacer()
              Text(row.example).font(.subheadline).foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
            }
            .padding(.vertical, 8)
          }
        }
      }
    }
  }
}

private struct PatternChangeLabelStyle: LabelStyle {
  func makeBody(configuration: Configuration) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      configuration.icon.font(.caption.weight(.semibold))
      configuration.title.foregroundStyle(.primary)
    }
  }
}
