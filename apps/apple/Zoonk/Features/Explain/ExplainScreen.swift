import SwiftUI

struct ExplainScreen: View {
  let goalId: String

  @Environment(ExplainStore.self) private var explain

  var body: some View {
    let resource = explain.explanation(goalID: goalId)

    Group {
      if case .loaded(let explanation) = resource.state {
        ExplanationView(explanation: explanation) {
          await resource.refresh()
        }
      } else {
        NavigationStack {
          Group {
            switch resource.state {
            case .failed(.notFound):
              NotFoundView()
            case .failed:
              PageLoadFailure {
                Label {
                  Text(
                    "We couldn't load this explanation", tableName: "Explain",
                    comment: "A quick explanation failed to load")
                } icon: {
                  Image(systemName: "wifi.exclamationmark")
                }
              } retry: {
                await resource.refresh()
              }
            case .idle, .loading, .empty, .loaded:
              ProgressView()
            }
          }
          .closesTask()
          .barName(
            Text(
              "Quick explanation", tableName: "Explain",
              comment: "Names an explanation's screen until its title loads"))
        }
      }
    }
    .loads(resource, refreshable: false)
  }
}

/// Main's explanation: its outline and wait until it can be read, then the lesson, which ends on
/// what the learner now knows.
private struct ExplanationView: View {
  let explanation: Explanation
  let reload: () async -> Void

  @Environment(AppRouter.self) private var router
  @State private var hasStarted = false
  /// A learner who waited sees the finished outline first; one opening a written explanation reads
  /// it at once.
  @State private var readsAtOnce: Bool

  init(explanation: Explanation, reload: @escaping () async -> Void) {
    self.explanation = explanation
    self.reload = reload
    _readsAtOnce = State(initialValue: explanation.lesson != nil)
  }

  var body: some View {
    if let lesson = explanation.lesson, readsAtOnce || hasStarted {
      LessonPlayerScreen(
        lessonId: lesson.id, host: LessonHost(title: explanation.title, steps: lesson.steps),
        ending: ending)
    } else {
      NavigationStack {
        ExplanationOutline(explanation: explanation, reload: reload) {
          hasStarted = true
        }
        .closesTask()
        .barName(Text(explanation.title))
      }
    }
  }

  private var ending: LessonEndSlot {
    LessonEndSlot { completion, correct, answered in
      AnyView(
        ExplainEnding(
          explanation: explanation, completion: completion, correct: correct, answered: answered,
          reload: reload))
    } done: {
      if explanation.hasStudyGoal {
        router.showRoot(of: .today)
      } else {
        router.dismissTask()
        router.open(.startGoal())
      }
    }
  }
}

/// Main's `ExplainWaiting`: the explanation's outline while it's written, and Start once it can be
/// read.
private struct ExplanationOutline: View {
  let explanation: Explanation
  let reload: () async -> Void
  let start: () -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @State private var isRetrying = false
  @State private var retryFailed = false

  var body: some View {
    ZoonkList {
      Section {
        PageHeader(Text(explanation.title), chip: Chip(quickExplanationLabel))
          .listRowBackground(Color.clear)
      }

      if explanation.lesson == nil {
        waiting
      }

      if !explanation.outline.isEmpty {
        Section {
          ForEach(Array(explanation.outline.enumerated()), id: \.offset) { index, title in
            Label {
              Text(title)
            } icon: {
              Text(index + 1, format: .number)
                .monospacedDigit()
                .foregroundStyle(.mutedForeground)
            }
          }

          Label {
            Text(
              "1 quick question at the end", tableName: "Explain",
              comment: "The check after a quick explanation's screens")
          } icon: {
            Image(systemName: "checkmark.circle")
              .foregroundStyle(.mutedForeground)
              .accessibilityHidden(true)
          }
        }
      }

      Section {
        DeeperRow(explanation: explanation)
      }
    }
    // Quiet during a retry, so one that goes through says it again.
    .announcesStatus(
      explanation.lesson == nil && !isRetrying && !retryFailed ? stillWriting : nil
    )
    // Main's explanation wait: the writing, then its outline until the learner starts it.
    .measuresWait(
      surface: "explanation", contentKind: "explanation", isActive: true,
      goalID: explanation.goalId
    )
    .bottomBar {
      if explanation.lesson != nil {
        StepButtons(
          continueLabel: Text(
            "Start", tableName: "Explain", comment: "Plays a written quick explanation"),
          onContinue: start)
      }
    }
  }

  @ViewBuilder
  private var waiting: some View {
    if let generationID = explanation.generationId {
      ExplanationWait(generationID: generationID, reload: reload)
    }

    Section {
      Button {
        Task { await retry() }
      } label: {
        Text("Try again", tableName: "Explain", comment: "Asks again for a slow quick explanation")
      }
      .disabled(isRetrying)
    } footer: {
      SectionFooter {
        if retryFailed {
          FailureLine(
            message: LocalizedStringResource(
              "Something went wrong on our side", table: "Explain",
              comment:
                "The title of a notice over something being prepared for the learner (a lesson, a list, a map) that failed or never started. A Try again button follows."
            ))
        } else {
          Text(stillWriting)
        }
      }
    }
  }

  private var stillWriting: String {
    String(
      localized: "Still getting your explanation ready.",
      table: "Explain", comment: "Under a quick explanation that's still being written")
  }

  private func retry() async {
    isRetrying = true
    retryFailed = false
    defer { isRetrying = false }

    do {
      _ = try await onboarding.writeGoal(goalID: explanation.goalId)
      await reload()
    } catch is CancellationError {
    } catch {
      retryFailed = true
    }
  }
}

/// Main's `ExplainEnding`: what the learner now knows and earned, the explanation in a few
/// sentences, then where to go further.
private struct ExplainEnding: View {
  let explanation: Explanation
  let completion: LessonPlayerState.Completion
  let correct: Int
  let answered: Int
  let reload: () async -> Void

  @Environment(AppRouter.self) private var router

  private var isSaving: Bool { completion.status == .saving }

  var body: some View {
    ZoonkList {
      Section {
        VStack(alignment: .leading, spacing: 24) {
          PageHeader(
            Text(explanation.title),
            chip: Chip(
              Text(
                "Now you know", tableName: "Explain",
                comment: "Eyebrow over a read quick explanation"),
              tone: .success))

          if isSaving {
            Text(
              "Saving your progress…", tableName: "Player",
              comment: "In place of a lesson's end title until the lesson is saved"
            )
            .foregroundStyle(.mutedForeground)
          } else if let summary = completion.summary {
            LessonReadouts(correct: correct, answered: answered, brainPower: summary.brainPower)
              .celebratesOnce(id: summary)
          }

          if !isSaving, let day = completion.summary?.day {
            DayMomentSections(result: day, chapter: completion.summary?.finishedChapter)
          }
        }
        .listRowBackground(Color.clear)
      }

      if !isSaving {
        if !explanation.recap.isEmpty {
          recap
        }

        goFurther
      }
    }
    .task {
      // The course to go further is linked a few seconds after the explanation can be read.
      if explanation.goFurther.course == nil {
        await reload()
      }
    }
  }

  private var recap: some View {
    Section {
      ForEach(Array(explanation.recap.enumerated()), id: \.offset) { index, line in
        Label {
          Text(line)
        } icon: {
          Text(index + 1, format: .number)
            .monospacedDigit()
            .foregroundStyle(.mutedForeground)
        }
      }
    } header: {
      SectionTitle(
        Text(
          "In \(explanation.recap.count) sentences", tableName: "Explain",
          comment: "Header over a quick explanation's summary; the number is its sentences"))
    }
  }

  private var goFurther: some View {
    Section {
      DeeperRow(explanation: explanation)

      ForEach(explanation.goFurther.questions, id: \.self) { question in
        Button {
          router.dismissTask()
          router.open(.startGoal(goal: question))
        } label: {
          ListRow(Text(question), description: quickExplanationLabel) {
            Image(systemName: "questionmark.circle")
          }
          .disclosureChevron()
        }
      }
    } header: {
      SectionTitle(
        Text(
          "Want to go further?", tableName: "Explain",
          comment: "Header over ways to go further after a quick explanation"))
    }
  }
}

/// Main's `DeeperStart`: the course the explanation belongs to, or a plan for the whole subject.
private struct DeeperRow: View {
  let explanation: Explanation

  @Environment(AppRouter.self) private var router

  var body: some View {
    Button {
      if let course = explanation.goFurther.course {
        router.open(.courseStart(courseId: course.id))
      } else {
        // Only fills the words in: reading them waits for the learner's tap.
        router.dismissTask()
        router.open(
          .startGoal(
            goal: String(
              localized: LocalizedStringResource(
                "I want to understand \(topic) in depth", table: "Explain",
                comment:
                  "A goal typed for the learner from a quick explanation's topic, mid-sentence"))))
      }
    } label: {
      ListRow(
        Text(
          "Learn more about this", tableName: "Explain",
          comment: "Starts a plan from a quick explanation"),
        description: description
      ) {
        Image(systemName: "graduationcap")
      }
      .disclosureChevron()
    }
  }

  private var description: Text {
    if let course = explanation.goFurther.course {
      Text(
        "Build a plan for \(course.title)", tableName: "Explain",
        comment: "Under the in-depth row: the course's title")
    } else {
      Text(
        "Build a plan for the whole subject", tableName: "Explain",
        comment: "Under the in-depth row")
    }
  }

  private var topic: String {
    let trimmed = explanation.title.trimmingCharacters(in: .whitespaces)
      .trimmingCharacters(in: CharacterSet(charactersIn: "?!."))
    let isAcronym = trimmed.prefix(2).allSatisfy(\.isUppercase)
    return isAcronym ? trimmed : trimmed.prefix(1).lowercased() + trimmed.dropFirst()
  }
}

private var quickExplanationLabel: Text {
  Text(
    "Quick explanation\u{00A0}· \(studyDuration(minutes: 5))",
    tableName: "Explain",
    comment: "Chip over a quick explanation's title: its kind and length")
}

private struct ExplanationWait: View {
  let generationID: String
  let reload: () async -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @State private var wait = GenerationWait(kind: .explanation).started

  var body: some View {
    Section {
      GenerationTimeline(wait: wait)
    }
    .listRowBackground(Color.clear)
    .listRowSeparator(.hidden)
    .task(id: generationID) {
      do {
        for try await event in onboarding.events(generationID: generationID) {
          wait.apply(event)

          await reload()

          if wait.isDone {
            break
          }
        }
      } catch {
        // The screen reads it again below either way.
      }

      await reload()
    }
  }
}
