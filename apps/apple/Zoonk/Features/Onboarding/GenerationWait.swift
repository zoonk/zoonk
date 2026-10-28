import SwiftUI

/// A run's phases as main's waits show them: each phase's label, and whether it's waiting, going or done. Steps map to phases the way `packages/learn/src/generation/generation-kinds.ts` maps them.
struct GenerationWait: Equatable, Sendable {
  enum Kind: Sendable {
    /// Reading typed words (`createGoalUnderstanding`).
    case understanding
    /// Writing a goal's skills and plan (`createGoals`, `createGoalGeneration`).
    case curriculum
    /// Writing a quick explanation of a question.
    case explanation
  }

  enum PhaseState: Equatable, Sendable {
    case waiting
    case working
    case done
  }

  struct Phase: Equatable, Identifiable, Sendable {
    let id: String
    let label: LocalizedStringResource
    /// Shown only once one of its steps is reported: runs skip it when it doesn't apply.
    let isOptional: Bool
    var state = PhaseState.waiting
    var isReported = false
  }

  let kind: Kind
  private(set) var phases: [Phase]
  private(set) var isDone = false
  /// The run already doing the same work, to follow instead (`joinRunning…`).
  private(set) var joinedGenerationID: String?

  init(kind: Kind) {
    self.kind = kind
    phases = Self.phases(for: kind)
  }

  /// The first phase going, before any event says so.
  var started: GenerationWait {
    var wait = self

    if wait.phases.allSatisfy({ $0.state == .waiting }), !wait.phases.isEmpty {
      wait.phases[0].state = .working
    }

    return wait
  }

  var visiblePhases: [Phase] {
    phases.filter { !$0.isOptional || $0.isReported }
  }

  mutating func apply(_ event: GenerationEvent) {
    guard let place = Self.place(of: event.step, kind: kind) else {
      return
    }

    switch place {
    case .done:
      if event.status == "completed" || event.status == "started" {
        isDone = true
      }
    case .join:
      joinedGenerationID = event.entityID
    case .phase(let id):
      guard let index = phases.firstIndex(where: { $0.id == id }) else {
        return
      }

      // Earlier phases are done once a later one reports.
      for earlier in phases.indices where earlier < index {
        phases[earlier].state = .done
      }

      phases[index].isReported = true
      phases[index].state = event.status == "completed" ? .done : .working

      // The plan is saved: Today builds the first day from it while the outlines go on. An explanation can be read once it's written.
      if event.status == "completed",
        (kind == .curriculum && event.step == "createPlan")
          || (kind == .explanation && event.step == "writeExplanation")
      {
        isDone = true
      }
    }
  }

  private enum Place {
    case phase(String)
    case done
    case join
  }

  private static func place(of step: String, kind: Kind) -> Place? {
    switch (kind, step) {
    case (.understanding, "readGoal"): .phase("read")
    case (.understanding, "findExamDates"): .phase("dates")
    case (.understanding, "understandingReady"): .done
    case (.understanding, "joinRunningUnderstanding"): .join
    case (.curriculum, "understandGoal"): .phase("goal")
    case (.curriculum, "readExamNotice"): .phase("notice")
    case (.curriculum, "buildSkillGraph"): .phase("skills")
    case (.curriculum, "saveSkills"), (.curriculum, "createPlan"),
      (.curriculum, "preparePlacement"):
      .phase("plan")
    case (.curriculum, "goalReady"), (.curriculum, "outlineCourses"),
      (.curriculum, "prepareFirstLessons"):
      .done
    case (.curriculum, "joinRunningGoal"): .join
    case (.explanation, "classifyQuestion"): .phase("read")
    case (.explanation, "findExplanation"): .phase("find")
    case (.explanation, "writeExplanation"): .phase("write")
    case (.explanation, "explanationReady"): .done
    case (.explanation, "joinRunningExplanation"): .join
    default: nil
    }
  }

  private static func phases(for kind: Kind) -> [Phase] {
    switch kind {
    case .understanding:
      [
        Phase(
          id: "read",
          label: LocalizedStringResource(
            "Reading your goal", table: "Onboarding",
            comment: "A step of the wait while a typed goal is read"),
          isOptional: false),
        Phase(
          id: "dates",
          label: LocalizedStringResource(
            "Checking the exam dates", table: "Onboarding",
            comment: "A step of the wait while a typed goal is read, when it's an exam"),
          isOptional: true),
      ]
    case .curriculum:
      [
        Phase(
          id: "goal",
          label: LocalizedStringResource(
            "Reading your goal", table: "Onboarding",
            comment: "A step of the wait while a plan is built"),
          isOptional: false),
        Phase(
          id: "notice",
          label: LocalizedStringResource(
            "Reading your material", table: "Onboarding",
            comment: "A step of the wait while a plan is built from the learner's own material"),
          isOptional: true),
        Phase(
          id: "skills",
          label: LocalizedStringResource(
            "Mapping the skills it takes", table: "Onboarding",
            comment: "A step of the wait while a plan is built"),
          isOptional: false),
        Phase(
          id: "plan",
          label: LocalizedStringResource(
            "Fitting the plan into your days", table: "Onboarding",
            comment: "A step of the wait while a plan is built"),
          isOptional: false),
      ]
    case .explanation:
      [
        Phase(
          id: "read",
          label: LocalizedStringResource(
            "Reading your question", table: "Onboarding",
            comment: "A step of the wait while a quick explanation is written"),
          isOptional: false),
        Phase(
          id: "find",
          label: LocalizedStringResource(
            "Checking if someone asked it before", table: "Onboarding",
            comment: "A step of the wait while a quick explanation is written"),
          isOptional: false),
        Phase(
          id: "write",
          label: LocalizedStringResource(
            "Writing about 5 short screens", table: "Onboarding",
            comment: "A step of the wait while a quick explanation is written"),
          isOptional: false),
      ]
    }
  }
}

/// The wait while a run works: its phases as a checklist, with the one going now marked by a spinner. Follows the run's event stream, and a run it hands over to; `onEnd` runs when the content is ready or the stream ends, so the caller reads the result. Without a run yet (the words were just sent), the first phase shows as going.
struct GenerationWaitView<Leading: View>: View {
  let title: LocalizedStringResource
  let description: LocalizedStringResource
  let generationID: String?
  let kind: GenerationWait.Kind
  let onEnd: () async -> Void
  @ViewBuilder let leading: () -> Leading

  @Environment(OnboardingStore.self) private var onboarding
  @State private var wait: GenerationWait?

  var body: some View {
    List {
      StepHeader(title: Text(title), description: Text(description))

      leading()

      Section {
        ForEach(shown.visiblePhases) { phase in
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
                  Text("Done", tableName: "Onboarding", comment: "A finished step of a wait"))
            }
          } label: {
            Text(phase.label)
              .foregroundStyle(phase.state == .waiting ? .secondary : .primary)
          }
        }
      }
    }
    .task(id: generationID) {
      guard let generationID else {
        return
      }

      await follow(generationID)
      await onEnd()
    }
  }

  /// Before the first event, the first phase is already going: the run started with the tap.
  private var shown: GenerationWait {
    wait ?? GenerationWait(kind: kind).started
  }

  private func follow(_ id: String) async {
    var current = GenerationWait(kind: kind).started
    wait = current

    do {
      for try await event in onboarding.events(generationID: id) {
        current.apply(event)
        wait = current

        if let joined = current.joinedGenerationID {
          await follow(joined)
          return
        }

        if current.isDone {
          return
        }
      }
    } catch {
      // The caller reads the result either way; a failed stream shows as the run's status.
    }
  }
}

extension GenerationWaitView where Leading == EmptyView {
  init(
    title: LocalizedStringResource,
    description: LocalizedStringResource,
    generationID: String?,
    kind: GenerationWait.Kind,
    onEnd: @escaping () async -> Void
  ) {
    self.init(
      title: title, description: description, generationID: generationID, kind: kind,
      onEnd: onEnd, leading: { EmptyView() })
  }
}
