import SwiftUI

/// Steps map to phases the way `packages/learn/src/generation/generation-kinds.ts` maps them.
struct GenerationWait: Equatable, Sendable {
  enum Kind: Sendable {
    case understanding
    case curriculum
    case explanation
    case levelTestBank
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
  private(set) var joinedGenerationID: String?

  init(kind: Kind) {
    self.kind = kind
    phases = Self.phases(for: kind)
  }

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

      // Today builds the first day once the plan is saved, while the outlines go on.
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
    case (.levelTestBank, "writeLevelTestBank"), (.levelTestBank, "joinLevelTestBank"):
      .phase("bank")
    case (.levelTestBank, "levelTestBankReady"): .done
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
    case .levelTestBank:
      [
        Phase(
          id: "bank",
          label: LocalizedStringResource(
            "Writing the level test questions", table: "Onboarding",
            comment: "The step of the wait while a language's level test questions are written"),
          isOptional: false)
      ]
    }
  }
}

enum GenerationFailure: Equatable, Sendable {
  case notStarted
  case connection
  case generation
}

/// It never gives up silently: no run, a lost stream or a stopped run each say so, with the way out.
struct GenerationWaitView<Leading: View, Trailing: View>: View {
  let title: LocalizedStringResource
  let description: LocalizedStringResource
  /// Replaces the description once the run failed or never started.
  var stoppedDescription: LocalizedStringResource?
  let generationID: String?
  let kind: GenerationWait.Kind
  /// Asks for the run's id while the caller doesn't have it: a run saves it a few seconds after it starts.
  var readGenerationID: (() async -> String?)?
  /// A POST the learner's tap makes; nil when there's nothing left to write. Without it, a stopped
  /// run is the caller's to read.
  var restart: (() async throws -> String?)?
  /// False while the result isn't there, which shows as lost updates.
  let readResult: () async -> Bool
  @ViewBuilder let leading: () -> Leading
  @ViewBuilder let trailing: () -> Trailing

  @Environment(OnboardingStore.self) private var onboarding
  @State private var wait: GenerationWait?
  @State private var failure: GenerationFailure?
  @State private var followedID: String?
  /// Counts reconnections, so following the same run again opens its stream again.
  @State private var connection = 0
  @State private var isRestarting = false

  private struct Following: Equatable {
    let id: String?
    let connection: Int
  }

  var body: some View {
    let runID = followedID ?? generationID

    List {
      StepHeader(title: Text(title), description: Text(shownDescription))

      leading()

      Section {
        ForEach(shown.visiblePhases) { phase in
          LabeledContent {
            switch phase.state {
            case .waiting:
              EmptyView()
            case .working:
              if failure == nil {
                ProgressView()
              }
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

      if let failure {
        GenerationFailureSection(
          failure: failure, isActing: isRestarting,
          act: failure == .connection || restart != nil ? { retry(failure) } : nil)
      }

      trailing()
    }
    .task(id: Following(id: runID, connection: connection)) {
      failure = nil

      if let runID {
        await finish(await follow(runID))
      } else {
        await readMissingID()
      }
    }
  }

  private var shown: GenerationWait {
    wait ?? GenerationWait(kind: kind).started
  }

  private var shownDescription: LocalizedStringResource {
    switch failure {
    case .generation?, .notStarted?: stoppedDescription ?? description
    case .connection?, nil: description
    }
  }

  private enum Ending {
    case ready
    /// The stream ended without saying so: the run's status says how it went.
    case ended(String)
    /// The stream broke and gave up reconnecting: the run may still be working.
    case lost
  }

  private func follow(_ id: String) async -> Ending {
    var current = GenerationWait(kind: kind).started
    wait = current

    do {
      for try await event in onboarding.events(generationID: id) {
        current.apply(event)
        wait = current

        if let joined = current.joinedGenerationID {
          return await follow(joined)
        }

        if current.isDone {
          return .ready
        }
      }

      return .ended(id)
    } catch {
      return .lost
    }
  }

  private func finish(_ ending: Ending) async {
    switch ending {
    case .ready:
      await read()
    case .lost:
      failure = .connection
    case .ended(let id):
      switch try? await onboarding.generationStatus(id: id) {
      case .completed:
        await read()
      case .stopped where restart != nil:
        failure = .generation
      case .stopped:
        await read()
      case .working, nil:
        failure = .connection
      }
    }
  }

  private func read() async {
    if await !readResult(), !Task.isCancelled {
      failure = .connection
    }
  }

  private func readMissingID() async {
    guard let readGenerationID else {
      return
    }

    // A run saves its id within a few seconds; with none after about 45 seconds, it didn't start.
    for _ in 0..<22 {
      if let id = await readGenerationID() {
        followedID = id
        return
      }

      do {
        try await Task.sleep(for: .seconds(2))
      } catch {
        return
      }
    }

    if restart != nil {
      failure = .notStarted
    }
  }

  private func retry(_ failure: GenerationFailure) {
    guard failure != .connection, let restart else {
      connection += 1
      return
    }

    isRestarting = true

    Task {
      defer { isRestarting = false }

      do {
        guard let id = try await restart() else {
          self.failure = nil
          await read()
          return
        }

        followedID = id
        connection += 1
      } catch is CancellationError {
      } catch {
        self.failure = .notStarted
      }
    }
  }
}

extension GenerationWaitView where Trailing == EmptyView {
  init(
    title: LocalizedStringResource,
    description: LocalizedStringResource,
    generationID: String?,
    kind: GenerationWait.Kind,
    readGenerationID: (() async -> String?)? = nil,
    restart: (() async throws -> String?)? = nil,
    readResult: @escaping () async -> Bool,
    @ViewBuilder leading: @escaping () -> Leading
  ) {
    self.init(
      title: title, description: description, generationID: generationID, kind: kind,
      readGenerationID: readGenerationID, restart: restart, readResult: readResult,
      leading: leading, trailing: { EmptyView() })
  }
}

extension GenerationWaitView where Leading == EmptyView {
  init(
    title: LocalizedStringResource,
    description: LocalizedStringResource,
    generationID: String?,
    kind: GenerationWait.Kind,
    readGenerationID: (() async -> String?)? = nil,
    restart: (() async throws -> String?)? = nil,
    readResult: @escaping () async -> Bool,
    @ViewBuilder trailing: @escaping () -> Trailing
  ) {
    self.init(
      title: title, description: description, generationID: generationID, kind: kind,
      readGenerationID: readGenerationID, restart: restart, readResult: readResult,
      leading: { EmptyView() }, trailing: trailing)
  }
}

extension GenerationWaitView where Leading == EmptyView, Trailing == EmptyView {
  init(
    title: LocalizedStringResource,
    description: LocalizedStringResource,
    stoppedDescription: LocalizedStringResource? = nil,
    generationID: String?,
    kind: GenerationWait.Kind,
    readGenerationID: (() async -> String?)? = nil,
    restart: (() async throws -> String?)? = nil,
    readResult: @escaping () async -> Bool
  ) {
    self.init(
      title: title, description: description, stoppedDescription: stoppedDescription,
      generationID: generationID, kind: kind, readGenerationID: readGenerationID,
      restart: restart, readResult: readResult, leading: { EmptyView() },
      trailing: { EmptyView() })
  }
}

struct GenerationFailureSection: View {
  let failure: GenerationFailure
  var isActing = false
  let act: (() -> Void)?

  var body: some View {
    Section {
      Label {
        VStack(alignment: .leading, spacing: 4) {
          title
            .font(.headline)
          description
        }
      } icon: {
        Image(
          systemName: failure == .connection ? "wifi.exclamationmark" : "exclamationmark.triangle"
        )
        .foregroundStyle(.secondary)
      }

      if let act {
        Button(action: act) {
          action
        }
        .disabled(isActing)
      }
    }
  }

  private var title: Text {
    switch failure {
    case .connection:
      Text(
        "Connection lost", tableName: "Onboarding", comment: "A wait that stopped getting updates")
    case .generation:
      Text("This didn't finish", tableName: "Onboarding", comment: "A run that failed")
    case .notStarted:
      Text("This didn't start", tableName: "Onboarding", comment: "A run that never started")
    }
  }

  private var description: Text {
    switch failure {
    case .connection:
      Text(
        "We stopped getting updates. It may still be working.", tableName: "Onboarding",
        comment: "Why a wait stopped getting updates")
    case .generation:
      Text(
        "Something went wrong on our side.", tableName: "Onboarding", comment: "Why a run failed")
    case .notStarted:
      Text(
        "We couldn't get this started.", tableName: "Onboarding",
        comment: "Why a run never started")
    }
  }

  private var action: Text {
    switch failure {
    case .connection:
      Text("Reconnect", tableName: "Onboarding", comment: "Follows a run again after lost updates")
    case .generation, .notStarted:
      Text("Try again", tableName: "Onboarding", comment: "Starts a failed run again")
    }
  }
}
