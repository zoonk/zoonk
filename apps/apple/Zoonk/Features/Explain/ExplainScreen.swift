import SwiftUI

/// A quick explanation (`/explain/[goalId]`): the wait while it's written, with each step live and the outline taking shape, then "See explanation" plays its screens and check in the lesson player. Back from it, "Now you know" sums it up, with ways to go further.
struct ExplainScreen: View {
  let goalId: String

  @Environment(ExplainStore.self) private var explain

  var body: some View {
    let resource = explain.explanation(goalID: goalId)

    NavigationStack {
      Group {
        switch resource.state {
        case .loaded(let explanation):
          ExplanationView(explanation: explanation) {
            await resource.refresh()
          }
        case .failed:
          ContentUnavailableView {
            Text(
              "We couldn't load this explanation", tableName: "Explain",
              comment: "A quick explanation failed to load")
          } actions: {
            Button {
              Task { await resource.refresh() }
            } label: {
              Text("Try again", tableName: "Explain", comment: "Loads the explanation again")
            }
          }
        case .idle, .loading, .empty:
          ProgressView()
        }
      }
      .closesTask()
    }
    .loads(resource, refreshable: false)
  }
}

private struct ExplanationView: View {
  let explanation: Explanation
  let reload: () async -> Void

  @Environment(AppRouter.self) private var router
  @Environment(OnboardingStore.self) private var onboarding
  @State private var hasPlayed = false
  @State private var isRetrying = false
  @State private var retryFailed = false

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          Text(
            "Quick explanation · \(Duration.seconds(300), format: .units(allowed: [.minutes], width: .abbreviated))",
            tableName: "Explain",
            comment: "Eyebrow over a quick explanation's title: its kind and length"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
          Text(explanation.title)
            .font(.title2.bold())
            .accessibilityAddTraits(.isHeader)
          Text(
            "No plan to set up.", tableName: "Explain", comment: "Under a quick explanation's title"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
        .listRowBackground(Color.clear)
      }

      if hasPlayed, !explanation.recap.isEmpty {
        recap
      }

      if explanation.lesson == nil {
        waiting
      }

      if !explanation.outline.isEmpty, !hasPlayed {
        Section {
          ForEach(Array(explanation.outline.enumerated()), id: \.offset) { index, title in
            Label {
              Text(title)
            } icon: {
              Text(index + 1, format: .number)
                .monospacedDigit()
                .foregroundStyle(.secondary)
            }
          }

          Label {
            Text(
              "1 quick question at the end", tableName: "Explain",
              comment: "The check after a quick explanation's screens")
          } icon: {
            Image(systemName: "checkmark.circle")
              .foregroundStyle(.secondary)
              .accessibilityHidden(true)
          }
        } header: {
          Text(
            "What's coming", tableName: "Explain",
            comment: "Header over a quick explanation's outline")
        }
      }

      goFurther

      if let lesson = explanation.lesson {
        if hasPlayed {
          StepButtons(
            continueLabel: Text(
              "Done", tableName: "Explain", comment: "Leaves a quick explanation"),
            skipLabel: Text(
              "Read it again", tableName: "Explain", comment: "Plays a quick explanation again"),
            onContinue: done
          ) {
            router.open(.lesson(lessonId: lesson.id))
          }
        } else {
          StepButtons(
            continueLabel: Text(
              "See explanation", tableName: "Explain", comment: "Plays a written quick explanation")
          ) {
            hasPlayed = true
            router.open(.lesson(lessonId: lesson.id))
          }
        }
      }
    }
  }

  /// The run writing it, live; one that stopped or takes long has its own way to start again.
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
      if retryFailed {
        Text(
          "We couldn't get this started.", tableName: "Explain",
          comment: "A slow explanation couldn't be asked again"
        )
        .foregroundStyle(.destructive)
      } else {
        Text(
          "Still writing your explanation. It shows up here as soon as it's ready.",
          tableName: "Explain",
          comment: "Under a quick explanation that's still being written")
      }
    }
  }

  /// "Now you know": the summary, one idea per line.
  private var recap: some View {
    Section {
      ForEach(Array(explanation.recap.enumerated()), id: \.offset) { index, line in
        Label {
          Text(line)
        } icon: {
          Text(index + 1, format: .number)
            .monospacedDigit()
            .foregroundStyle(.secondary)
        }
      }
    } header: {
      Label {
        Text(
          "Now you know", tableName: "Explain", comment: "Header over a quick explanation's summary"
        )
      } icon: {
        Image(systemName: "checkmark.circle.fill")
      }
      .foregroundStyle(.success)
    }
  }

  /// Learning the subject in depth as a plan of its own, or another quick question.
  private var goFurther: some View {
    Section {
      Button {
        if let course = explanation.goFurther.course {
          router.open(.courseStart(courseId: course.id))
        } else {
          startGoal(
            String(
              localized: LocalizedStringResource(
                "I want to understand \(topic) in depth", table: "Explain",
                comment:
                  "A goal typed for the learner from a quick explanation's topic, mid-sentence")))
        }
      } label: {
        VStack(alignment: .leading, spacing: 2) {
          Text(
            "I want to learn this in depth", tableName: "Explain",
            comment: "Starts a plan from a quick explanation"
          )
          .foregroundStyle(.primary)
          Group {
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
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
      }

      if hasPlayed {
        ForEach(explanation.goFurther.questions, id: \.self) { question in
          Button {
            startGoal(question)
          } label: {
            Text(question)
              .foregroundStyle(.primary)
          }
        }
      }
    } header: {
      Text(
        "Want to go further?", tableName: "Explain",
        comment: "Header over ways to go further after a quick explanation")
    }
  }

  /// The explanation's title inside a sentence: "how inflation works", an acronym ("GDP") as it is.
  private var topic: String {
    let trimmed = explanation.title.trimmingCharacters(in: .whitespaces)
      .trimmingCharacters(in: CharacterSet(charactersIn: "?!."))
    let isAcronym = trimmed.prefix(2).allSatisfy(\.isUppercase)
    return isAcronym ? trimmed : trimmed.prefix(1).lowercased() + trimmed.dropFirst()
  }

  /// Onboarding with the words filled in, as main's links to `/start?goal=`; reading them waits for the learner's tap.
  private func startGoal(_ words: String) {
    router.dismissTask()
    router.open(.startGoal(goal: words))
  }

  /// Back to the plan's day, or, with only explanations, to asking the next question.
  private func done() {
    if explanation.hasStudyGoal {
      router.showRoot(of: .today)
    } else {
      router.dismissTask()
      router.open(.startGoal())
    }
  }

  private func retry() async {
    isRetrying = true
    retryFailed = false
    defer { isRetrying = false }

    do {
      _ = try await onboarding.writeGoal(goalID: explanation.goalId)
      await reload()
    } catch {
      retryFailed = true
    }
  }
}

/// The run writing an explanation, step by step; once it can be read, the screen reads it again.
private struct ExplanationWait: View {
  let generationID: String
  let reload: () async -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @State private var wait = GenerationWait(kind: .explanation).started

  var body: some View {
    Section {
      ForEach(wait.visiblePhases) { phase in
        LabeledContent {
          switch phase.state {
          case .waiting:
            EmptyView()
          case .working:
            ProgressView()
          case .done:
            Image(systemName: "checkmark")
              .fontWeight(.semibold)
              .foregroundStyle(.success)
              .accessibilityLabel(
                Text("Done", tableName: "Explain", comment: "A finished step of a wait"))
          }
        } label: {
          Text(phase.label)
            .foregroundStyle(phase.state == .waiting ? .secondary : .primary)
        }
      }
    }
    .task(id: generationID) {
      do {
        for try await event in onboarding.events(generationID: generationID) {
          wait.apply(event)

          // The outline arrives as the run writes it.
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
