import SwiftUI

/// "Try again" starts the run again only from the learner's tap.
struct PlanBuildingView: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var store
  @State private var run = PlanBuildingRun()
  @State private var isRestarting = false

  let goal: LearnerGoal
  let onReady: () async -> Void

  var body: some View {
    List {
      Section {
        ForEach(run.phases) { phase in
          Label {
            Text(phase.title)
              .foregroundStyle(phase.state == .todo ? .secondary : .primary)
          } icon: {
            if phase.state == .current {
              ProgressView()
            } else {
              StatusMark(status: phase.state == .done ? .done : .todo)
            }
          }
        }
      } header: {
        Text(
          "\(goal.title) · Building your plan", tableName: "Plan",
          comment: "Eyebrow of the Plan while the goal's plan is being built")
      } footer: {
        Text(
          "It usually takes a minute or two. Your plan opens here as soon as it's ready.",
          tableName: "Plan", comment: "Explains that the plan appears on its own once it's built")
      }

      if run.status == .missing || run.status == .failed {
        Section {
          if run.status == .failed {
            Text(
              "Your plan couldn't be built this time.", tableName: "Plan",
              comment: "Says the run building the plan failed")
          }

          Button {
            Task { await restart() }
          } label: {
            Text("Try again", tableName: "Plan", comment: "Starts building the plan again")
          }
          .disabled(isRestarting)

          if run.status == .missing {
            Button {
              router.open(.goalSetup(goalId: goal.id))
            } label: {
              Text(
                "Continue setup", tableName: "Plan",
                comment: "Opens the goal's setup where the learner left it")
            }
          }
        }
      }
    }
    .task(id: run.generationId ?? goal.id) {
      await follow()
    }
  }

  private func follow() async {
    guard let session = store.cache.session.authenticatedSession else {
      return
    }

    let token = session.bearerToken
    let goalId = goal.id

    if run.generationId == nil {
      guard let id = try? await store.api.goalGenerationId(token: token, goalId: goalId) else {
        run.status = .missing
        return
      }

      run.generationId = id
      return
    }

    guard let id = run.generationId else {
      return
    }

    run.status = .running

    do {
      for try await event in store.api.generationEvents(id: id, token: token) {
        run.record(event)

        if run.isPlanSaved {
          await onReady()
          await learner.summary.refresh()
          return
        }
      }
    } catch is CancellationError {
      return
    } catch {}

    // The stream ended without a saved plan: it failed, or the plan was saved between reads.
    await onReady()

    if !Task.isCancelled {
      run.status = .failed
    }
  }

  private func restart() async {
    guard let session = store.cache.session.authenticatedSession else {
      return
    }

    isRestarting = true
    defer { isRestarting = false }

    if let id = try? await store.api.restartGeneration(token: session.bearerToken, goalId: goal.id)
    {
      run = PlanBuildingRun()
      run.generationId = id
    }
  }
}

/// Done once the plan is saved, while outlines and first lessons go on.
struct PlanBuildingRun {
  enum Status: Equatable {
    case failed
    case missing
    case running
    case waiting
  }

  struct Phase: Identifiable {
    enum State {
      case current
      case done
      case todo
    }

    let id: String
    let title: String
    var state: State
  }

  var generationId: String?
  var status = Status.waiting
  private var steps: [String: String] = [:]

  var isPlanSaved: Bool { steps["createPlan"] == "completed" }

  mutating func record(_ event: GenerationEvent) {
    steps[event.step] = event.status
  }

  var phases: [Phase] {
    let phaseOf = Self.stepPhases
    var reached: [String: String] = [:]

    for (step, status) in steps {
      guard let phase = phaseOf[step] else {
        continue
      }

      if reached[phase] != "started" {
        reached[phase] = status
      }
    }

    let ids = ["goal"] + (reached["notice"] == nil ? [] : ["notice"]) + ["skills", "plan"]
    let lastReached = ids.lastIndex { reached[$0] != nil }

    return ids.enumerated().map { index, id in
      let state: Phase.State =
        if isPlanSaved || reached[id] == "completed" || (lastReached.map { index < $0 } ?? false) {
          .done
        } else if reached[id] != nil || (lastReached == nil && index == 0) {
          .current
        } else {
          .todo
        }

      return Phase(id: id, title: Self.title(id), state: state)
    }
  }

  private static let stepPhases = [
    "understandGoal": "goal",
    "readExamNotice": "notice",
    "buildSkillGraph": "skills",
    "saveSkills": "plan",
    "preparePlacement": "plan",
    "createPlan": "plan",
  ]

  private static func title(_ phase: String) -> String {
    switch phase {
    case "goal":
      String(localized: "Reading your goal", table: "Plan", comment: "A phase of building the plan")
    case "notice":
      String(
        localized: "Reading your material", table: "Plan", comment: "A phase of building the plan")
    case "skills":
      String(
        localized: "Mapping the skills it takes", table: "Plan",
        comment: "A phase of building the plan")
    default:
      String(
        localized: "Fitting the plan into your days", table: "Plan",
        comment: "A phase of building the plan")
    }
  }
}
