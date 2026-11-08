import SwiftUI

/// Steps map to phases the way `packages/learn/src/generation/generation-kinds.ts` maps them, with
/// each phase's usual duration and the lines main's `use-generation-copy.ts` shows while it runs.
struct GenerationWait: Equatable, Sendable {
  enum Kind: Sendable {
    case understanding
    case curriculum
    /// The goal's run while placement waits for its questions.
    case placement
    case explanation
    case levelTestBank
    case lesson
  }

  enum PhaseState: Equatable, Sendable {
    case waiting
    case working
    case done
  }

  /// Main's `NumberedLines`: "Writing screen 3…", with a check after every second one.
  struct NumberedLines: Equatable, Sendable {
    enum Line: Equatable, Sendable {
      case lessonScreen
      case explanationScreen
    }

    let count: Int
    let line: Line
  }

  struct Phase: Equatable, Identifiable, Sendable {
    let id: String
    let label: LocalizedStringResource
    /// Shown only once one of its steps is reported: runs skip it when it doesn't apply.
    let isOptional: Bool
    /// Runs at the same time as the phase before it, so each finishes on its own steps.
    var runsAlongside = false
    /// Its usual duration on real runs, which weighs it in the bar.
    let seconds: Double
    /// What it's doing, one line every few seconds while it runs.
    var lines: [LocalizedStringResource] = []
    var numbered: NumberedLines?
    var state = PhaseState.waiting
    var isReported = false
    var skillName: String?
    /// The server's times, so a phase's clock reads the same after a reconnection replays its steps.
    var startedAt: Date?
    var endedAt: Date?
  }

  /// A learn goal's first lesson, which its plan's run writes before the plan.
  struct FirstLesson: Equatable, Sendable {
    let id: String
    let title: String
    var isReady: Bool
    /// The server's times, as each phase keeps them.
    var startedAt: Date?
    var endedAt: Date?
  }

  /// Main's `useAnimatedProgress`: between reports the share drifts toward the end of the running
  /// phases, from where it was shown when the last report moved it.
  private struct Drift: Equatable {
    var base: Double
    var movedAt: Date
    var share: Double
    var target: Double
  }

  let kind: Kind
  private(set) var phases: [Phase]
  private(set) var isDone = false
  private(set) var firstLesson: FirstLesson?
  /// This device's clock minus the server's: a replayed event arrives long after its time, so the
  /// smallest gap is the closest to the clocks' difference.
  private(set) var clockOffset: TimeInterval?
  private var drift: Drift

  init(kind: Kind, since: Date = .now) {
    self.kind = kind
    phases = Self.phases(for: kind)
    drift = Drift(base: 0, movedAt: since, share: 0, target: 0)
  }

  var started: GenerationWait {
    var wait = self

    if wait.phases.allSatisfy({ $0.state == .waiting }), !wait.phases.isEmpty {
      wait.moving(at: wait.drift.movedAt) { $0.phases[0].state = .working }
    }

    return wait
  }

  /// Every phase done, for a wait whose result is already there.
  var finished: GenerationWait {
    var wait = self

    if !wait.isDone {
      wait.finish(at: nil)
    }

    return wait
  }

  /// What the onboarding read says of lesson 1: the read is the truth after a reconnect, so a lesson
  /// either side calls ready is ready.
  func firstLesson(read: FirstLesson?) -> FirstLesson? {
    guard let live = firstLesson else {
      return read
    }

    guard let read, read.id == live.id, read.isReady else {
      return live
    }

    var merged = live
    merged.isReady = true
    return merged
  }

  var visiblePhases: [Phase] {
    phases.filter { !$0.isOptional || $0.isReported }
  }

  /// Main's `getPhaseProgress`: the share of the usual time the finished phases take, and where it
  /// gets once the running ones finish, which the bar drifts toward.
  var progress: (share: Double, target: Double, runningSeconds: Double?) {
    let shown = visiblePhases
    let total = shown.reduce(0) { $0 + $1.seconds }

    guard !isDone, total > 0 else {
      return (1, 1, nil)
    }

    let done = shown.filter { $0.state == .done }.reduce(0) { $0 + $1.seconds }
    let running = shown.filter { $0.state == .working }.map(\.seconds)

    return (done / total, (done + running.reduce(0, +)) / total, running.max())
  }

  /// How long a lesson usually takes to write, from its phases' usual durations.
  static let lessonSeconds = phases(for: .lesson).reduce(0) { $0 + $1.seconds }

  /// Estimates are never the finish line: only the end of the work fills the bar.
  private static let driftCap = 0.97
  private static let driftSeconds = 30.0

  /// The share every bar and ring of this wait shows at `date`: never full before the work is, and
  /// never back unless the run started over.
  func shownShare(at date: Date) -> Double {
    guard !isDone else {
      return 1
    }

    let ceiling = min(drift.target, Self.driftCap)

    guard drift.base < ceiling else {
      return max(drift.base, drift.share)
    }

    let constant = (progress.runningSeconds ?? Self.driftSeconds) / 2
    let elapsed = max(0, date.timeIntervalSince(drift.movedAt).rounded(.down))
    let drifted = drift.base + (ceiling - drift.base) * (1 - exp(-elapsed / constant))
    return max(drifted, drift.share)
  }

  /// A report that moves the progress drifts on from what was shown when it came.
  private mutating func moving(at date: Date, _ change: (inout GenerationWait) -> Void) {
    let shown = shownShare(at: date)
    change(&self)
    let progress = self.progress

    guard progress.share != drift.share || progress.target != drift.target else {
      return
    }

    drift = Drift(
      base: progress.share < drift.share ? progress.share : max(shown, progress.share),
      movedAt: date, share: progress.share, target: progress.target)
  }

  mutating func apply(_ event: GenerationEvent, receivedAt: Date = .now) {
    if let at = event.at {
      let gap = receivedAt.timeIntervalSince(at)
      clockOffset = min(clockOffset ?? gap, gap)
    }

    recordFirstLesson(event)

    guard let place = Self.place(of: event.step, kind: kind) else {
      return
    }

    moving(at: receivedAt) { $0.applyPlace(place, of: event) }
  }

  /// The run reports lesson 1 once as it's picked and once as it's ready, before or after the plan.
  private mutating func recordFirstLesson(_ event: GenerationEvent) {
    switch event.step {
    case "writeFirstLesson":
      guard let id = event.lessonID, let title = event.lessonTitle else {
        return
      }

      let known = firstLesson?.id == id ? firstLesson : nil
      firstLesson = FirstLesson(
        id: id, title: title, isReady: known?.isReady ?? false,
        startedAt: known?.startedAt ?? event.at, endedAt: known?.endedAt)
    case "firstLessonReady":
      guard var lesson = firstLesson, lesson.id == event.lessonID else {
        return
      }

      lesson.isReady = true
      lesson.endedAt = lesson.endedAt ?? event.at
      firstLesson = lesson
    default:
      break
    }
  }

  private mutating func applyPlace(_ place: Place, of event: GenerationEvent) {
    let at = event.at

    switch place {
    case .done:
      if event.status == "completed" || event.status == "started" {
        finish(at: at)
      }
    case .phase(let id):
      guard let index = phases.firstIndex(where: { $0.id == id }) else {
        return
      }

      let stage = stage(of: index)

      // Earlier stages are done once a later one reports, and a stage's phases run together.
      for earlier in phases.indices
      where earlier < stage.lowerBound && phases[earlier].state != .done {
        end(earlier, at: at)
      }

      start(stage, at: at)

      phases[index].isReported = true
      phases[index].skillName = event.skillName ?? phases[index].skillName

      if event.status == "completed" {
        // A step that finishes after the wait moved on still ends its phase then.
        phases[index].endedAt = [phases[index].endedAt, at].compactMap(\.self).max()
        end(index, at: at)
        startNextStage(after: stage, at: at)
      } else {
        phases[index].state = .working
      }

      // Today builds the first day once the plan is saved, while the outlines go on.
      if event.status == "completed",
        (kind == .curriculum && event.step == "createPlan")
          || (kind == .explanation && event.step == "writeExplanation")
      {
        finish(at: at)
      }
    }
  }

  /// A stage starts when the one before it finished, so the clocks run on from each other.
  private mutating func start(_ stage: Range<Int>, at: Date?) {
    let previous = stage.lowerBound > 0 ? self.stage(of: stage.lowerBound - 1) : nil
    let startedAt = previous.flatMap { phases[$0].compactMap(\.endedAt).max() } ?? at

    for index in stage where phases[index].state != .done {
      phases[index].state = .working
      phases[index].startedAt = phases[index].startedAt ?? startedAt
    }
  }

  /// As main's wait does, the next stage runs once every phase of this one finished.
  private mutating func startNextStage(after stage: Range<Int>, at: Date?) {
    guard stage.upperBound < phases.endIndex,
      phases[stage].allSatisfy({ $0.state == .done })
    else {
      return
    }

    start(self.stage(of: stage.upperBound), at: at)
  }

  private mutating func end(_ index: Int, at: Date?) {
    phases[index].state = .done
    phases[index].startedAt = phases[index].startedAt ?? at
    phases[index].endedAt = phases[index].endedAt ?? at
  }

  private mutating func finish(at: Date?) {
    isDone = true

    for index in phases.indices {
      if phases[index].state == .working {
        phases[index].endedAt = phases[index].endedAt ?? at
      }

      phases[index].state = .done
    }
  }

  /// The phases that run at the same time as the one at `index`, itself included.
  private func stage(of index: Int) -> Range<Int> {
    let start = phases[...index].lastIndex { !$0.runsAlongside } ?? 0
    let end = phases[(index + 1)...].firstIndex { !$0.runsAlongside } ?? phases.endIndex
    return start..<end
  }

  private enum Place {
    case phase(String)
    case done
  }

  private static func place(of step: String, kind: Kind) -> Place? {
    switch (kind, step) {
    case (.understanding, "readGoal"): .phase("read")
    case (.understanding, "findExamDates"): .phase("dates")
    case (.understanding, "understandingReady"): .done
    case (.curriculum, "understandGoal"): .phase("goal")
    case (.curriculum, "readExamNotice"): .phase("notice")
    case (.curriculum, "buildSkillGraph"): .phase("skills")
    case (.curriculum, "saveSkills"), (.curriculum, "createPlan"),
      (.curriculum, "preparePlacement"):
      .phase("plan")
    case (.curriculum, "goalReady"), (.curriculum, "outlineCourses"),
      (.curriculum, "prepareFirstLessons"):
      .done
    case (.placement, "understandGoal"): .phase("goal")
    case (.placement, "readExamNotice"): .phase("notice")
    case (.placement, "buildSkillGraph"): .phase("skills")
    case (.placement, "saveSkills"), (.placement, "createPlan"), (.placement, "preparePlacement"),
      (.placement, "outlineCourses"), (.placement, "prepareFirstLessons"):
      .phase("questions")
    case (.placement, "goalReady"): .done
    case (.explanation, "classifyQuestion"): .phase("read")
    case (.explanation, "findExplanation"): .phase("find")
    case (.explanation, "writeExplanation"): .phase("write")
    case (.explanation, "explanationReady"): .done
    case (.levelTestBank, "writeLevelTestBank"): .phase("bank")
    case (.levelTestBank, "levelTestBankReady"): .done
    case (.lesson, "planLesson"): .phase("plan")
    case (.lesson, "writeLesson"): .phase("write")
    case (.lesson, "markLesson"): .phase("mark")
    case (.lesson, "drawPictures"): .phase("draw")
    case (.lesson, "lessonReady"): .done
    default: nil
    }
  }

  /// The goal's run reads the goal, maybe its material, then maps its skills, for every wait on it.
  private static let goalPhases: [Phase] = [
    Phase(
      id: "goal",
      label: LocalizedStringResource(
        "Reading your goal", table: "Onboarding",
        comment: "A step of the wait while a plan is built"),
      isOptional: false, seconds: 8,
      lines: [
        LocalizedStringResource(
          "Reading your answers…", table: "Onboarding",
          comment: "What the wait is doing while a plan is built"),
        LocalizedStringResource(
          "Deciding how deep to go…", table: "Onboarding",
          comment: "What the wait is doing while a plan is built"),
      ]),
    Phase(
      id: "notice",
      label: LocalizedStringResource(
        "Reading your material", table: "Onboarding",
        comment: "A step of the wait while a plan is built from the learner's own material"),
      isOptional: true, seconds: 15,
      lines: [
        LocalizedStringResource(
          "Finding the topics it covers…", table: "Onboarding",
          comment: "What the wait is doing while it reads the learner's own material"),
        LocalizedStringResource(
          "Putting them in the order it teaches…", table: "Onboarding",
          comment: "What the wait is doing while it reads the learner's own material"),
      ]),
    Phase(
      id: "skills",
      label: LocalizedStringResource(
        "Mapping the skills it takes", table: "Onboarding",
        comment: "A step of the wait while a plan is built"),
      isOptional: false, seconds: 60,
      lines: [
        LocalizedStringResource(
          "Listing what your goal asks for…", table: "Onboarding",
          comment: "What the wait is doing while a plan is built"),
        LocalizedStringResource(
          "Putting the skills in order…", table: "Onboarding",
          comment: "What the wait is doing while a plan is built"),
        LocalizedStringResource(
          "Checking nothing important is missing…", table: "Onboarding",
          comment: "What the wait is doing while a plan is built"),
      ]),
  ]

  private static func phases(for kind: Kind) -> [Phase] {
    switch kind {
    case .understanding:
      [
        Phase(
          id: "read",
          label: LocalizedStringResource(
            "Reading your goal", table: "Onboarding",
            comment: "A step of the wait while a typed goal is read"),
          isOptional: false, seconds: 8,
          lines: [
            LocalizedStringResource(
              "Reading what you wrote…", table: "Onboarding",
              comment: "What the wait is doing while a typed goal is read"),
            LocalizedStringResource(
              "Working out what you want to reach…", table: "Onboarding",
              comment: "What the wait is doing while a typed goal is read"),
            LocalizedStringResource(
              "Checking if it's an exam, a language or a subject…", table: "Onboarding",
              comment: "What the wait is doing while a typed goal is read"),
          ]),
        Phase(
          id: "dates",
          label: LocalizedStringResource(
            "Checking the exam dates", table: "Onboarding",
            comment: "A step of the wait while a typed goal is read, when it's an exam"),
          isOptional: true, seconds: 12,
          lines: [
            LocalizedStringResource(
              "Looking up the exam calendar…", table: "Onboarding",
              comment: "What the wait is doing while it checks an exam's dates"),
            LocalizedStringResource(
              "Finding the dates for your year…", table: "Onboarding",
              comment: "What the wait is doing while it checks an exam's dates"),
          ]),
      ]
    case .curriculum:
      goalPhases + [
        Phase(
          id: "plan",
          label: LocalizedStringResource(
            "Fitting the plan into your days", table: "Onboarding",
            comment: "A step of the wait while a plan is built"),
          isOptional: false, seconds: 15,
          lines: [
            LocalizedStringResource(
              "Finding lessons in the Library…", table: "Onboarding",
              comment: "What the wait is doing while a plan is built"),
            LocalizedStringResource(
              "Spreading the skills over your days…", table: "Onboarding",
              comment: "What the wait is doing while a plan is built"),
            LocalizedStringResource(
              "Saving your plan…", table: "Onboarding",
              comment: "What the wait is doing while a plan is built"),
          ])
      ]
    case .placement:
      goalPhases + [
        Phase(
          id: "questions",
          label: LocalizedStringResource(
            "Writing your questions", table: "Onboarding",
            comment: "A step of the wait while placement's questions are written"),
          isOptional: false, seconds: 40,
          lines: [
            LocalizedStringResource(
              "Picking the skills to ask about…", table: "Onboarding",
              comment: "What the wait is doing while placement's questions are written")
          ])
      ]
    case .explanation:
      [
        Phase(
          id: "read",
          label: LocalizedStringResource(
            "Reading your question", table: "Onboarding",
            comment: "A step of the wait while a quick explanation is written"),
          isOptional: false, seconds: 2,
          lines: [
            LocalizedStringResource(
              "Reading your question…", table: "Onboarding",
              comment: "What the wait is doing while a quick explanation is written")
          ]),
        Phase(
          id: "find",
          label: LocalizedStringResource(
            "Checking if someone asked it before", table: "Onboarding",
            comment: "A step of the wait while a quick explanation is written"),
          isOptional: false, seconds: 2,
          lines: [
            LocalizedStringResource(
              "Looking for a matching explanation…", table: "Onboarding",
              comment: "What the wait is doing while a quick explanation is written")
          ]),
        Phase(
          id: "write",
          label: LocalizedStringResource(
            "Writing about 5 short screens", table: "Onboarding",
            comment: "A step of the wait while a quick explanation is written"),
          isOptional: false, seconds: 12,
          numbered: NumberedLines(count: 5, line: .explanationScreen)),
      ]
    case .levelTestBank:
      [
        Phase(
          id: "bank",
          label: LocalizedStringResource(
            "Writing the level test questions", table: "Onboarding",
            comment: "The step of the wait while a language's level test questions are written"),
          isOptional: false, seconds: 60,
          lines: [
            LocalizedStringResource(
              "Choosing texts from beginner to advanced…", table: "Onboarding",
              comment: "What the wait is doing while a language's level test questions are written"
            ),
            LocalizedStringResource(
              "Writing the reading questions…", table: "Onboarding",
              comment: "What the wait is doing while a language's level test questions are written"
            ),
            LocalizedStringResource(
              "Writing the listening questions…", table: "Onboarding",
              comment: "What the wait is doing while a language's level test questions are written"
            ),
            LocalizedStringResource(
              "Checking each question has one right answer…", table: "Onboarding",
              comment: "What the wait is doing while a language's level test questions are written"
            ),
          ])
      ]
    case .lesson:
      [
        Phase(
          id: "plan",
          label: LocalizedStringResource(
            "Planning the lesson", table: "Player",
            comment: "A step of the wait while a lesson is written"),
          isOptional: false, seconds: 40,
          lines: [
            LocalizedStringResource(
              "Choosing what to cover…", table: "Player",
              comment: "What the wait is doing while a lesson is planned"),
            LocalizedStringResource(
              "Picking the best way to explain it…", table: "Player",
              comment:
                "What the wait is doing while a lesson is planned. \"It\" is the lesson's topic."),
          ]),
        Phase(
          id: "write",
          label: LocalizedStringResource(
            "Writing the lesson", table: "Player",
            comment: "A step of the wait while a lesson is written"),
          isOptional: false, seconds: 50,
          numbered: NumberedLines(count: 6, line: .lessonScreen)),
        Phase(
          id: "mark",
          label: LocalizedStringResource(
            "Highlighting the key ideas", table: "Player",
            comment:
              "A step of the wait while a lesson is written, like \"Planning the lesson\" and \"Writing the lesson\" before it. \"Ideas\" are the lesson map's ideas, as in \"Idea 2 of 4\"."
          ),
          isOptional: false, seconds: 10,
          lines: [
            LocalizedStringResource(
              "Underlining what matters most…", table: "Player",
              comment: "What the wait is doing while a lesson's key ideas are highlighted"),
            LocalizedStringResource(
              "Matching each screen to its idea…", table: "Player",
              comment:
                "What the wait is doing while a lesson's key ideas are highlighted. \"Idea\" is one of the lesson map's ideas, as in \"Idea 2 of 4\"."
            ),
          ]),
        Phase(
          id: "draw",
          label: LocalizedStringResource(
            "Drawing the pictures", table: "Player",
            comment:
              "A step of the wait while a lesson is written, like \"Planning the lesson\" and \"Writing the lesson\" before it"
          ),
          isOptional: false, runsAlongside: true, seconds: 45,
          lines: [
            LocalizedStringResource(
              "Drawing what each screen describes…", table: "Player",
              comment: "What the wait is doing while a lesson's pictures are drawn"),
            LocalizedStringResource(
              "Drawing an icon for each idea…", table: "Player",
              comment:
                "What the wait is doing while a lesson's pictures are drawn. \"Idea\" is one of the lesson map's ideas, as in \"Idea 2 of 4\"."
            ),
          ]),
      ]
    }
  }
}

extension GenerationWait.Phase {
  /// Main's `getDetailLine`: the lines in order, then the numbered ones, then the lines again.
  func detailLine(tick: Int) -> LocalizedStringResource? {
    var sequence = lines
    var loop = lines

    if let numbered {
      let review = numbered.review

      for number in 1...max(numbered.count, 1) {
        sequence.append(numbered.text(number))

        if number.isMultiple(of: 2), number < numbered.count {
          sequence.append(review)
        }
      }

      loop.append(review)
    }

    if tick < sequence.count {
      return sequence[tick]
    }

    return loop.isEmpty ? nil : loop[(tick - sequence.count) % loop.count]
  }
}

extension GenerationWait.NumberedLines {
  fileprivate func text(_ number: Int) -> LocalizedStringResource {
    switch line {
    case .lessonScreen:
      LocalizedStringResource(
        "Writing screen \(number)…", table: "Player",
        comment: "What the wait is doing while a lesson is written: the screen it's on")
    case .explanationScreen:
      LocalizedStringResource(
        "Writing screen \(number)…", table: "Onboarding",
        comment: "What the wait is doing while a quick explanation is written: the screen it's on")
    }
  }

  fileprivate var review: LocalizedStringResource {
    switch line {
    case .lessonScreen:
      LocalizedStringResource(
        "Checking the answers…", table: "Player",
        comment: "What the wait is doing between screens while a lesson is written")
    case .explanationScreen:
      LocalizedStringResource(
        "Checking the facts…", table: "Onboarding",
        comment: "What the wait is doing between screens while a quick explanation is written")
    }
  }
}

enum GenerationFailure: Equatable, Sendable {
  case notStarted
  case connection
  case generation
}

/// A run as a wait shows it, and what it reported on the side.
struct FollowedRun {
  let wait: GenerationWait
  let failure: GenerationFailure?
  /// The goal's warm-up deck, once the run reported it.
  let warmUpID: String?
  let isRestarting: Bool
  /// Nil when nothing can be done about the failure.
  let retry: (() -> Void)?

  /// Stopped or never started, not just a lost stream: the work needs starting again.
  var isStopped: Bool {
    failure == .generation || failure == .notStarted
  }

  /// The phase running now, said once it changes.
  var workingLabel: String? {
    guard failure == nil, let phase = wait.visiblePhases.first(where: { $0.state == .working })
    else {
      return nil
    }

    return String(localized: phase.label)
  }
}

/// Follows a run for a wait. It never gives up silently: no run, a lost stream or a stopped run
/// each say so, with the way out.
struct GenerationFollower<Content: View>: View {
  let generationID: String?
  let kind: GenerationWait.Kind
  /// Asks for the run's id while the caller doesn't have it: a run saves it a few seconds after it starts.
  var readGenerationID: (() async -> String?)?
  /// A POST the learner's tap makes; nil when there's nothing left to write. Without it, a stopped
  /// run is the caller's to read.
  var restart: (() async throws -> String?)?
  /// False while the result isn't there, which shows as lost updates.
  let readResult: () async -> Bool
  /// For a caller that waits for the whole run too: the wait follows the run past `readResult` and
  /// calls this once it ends.
  var onRunEnd: (() -> Void)?
  @ViewBuilder let content: (FollowedRun) -> Content

  @Environment(OnboardingStore.self) private var onboarding
  @State private var wait: GenerationWait?
  /// Kept through reconnections, which read the run's events from the start again.
  @State private var warmUpID: String?
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
    let run = FollowedRun(
      wait: wait ?? GenerationWait(kind: kind).started, failure: failure, warmUpID: warmUpID,
      isRestarting: isRestarting,
      retry: failure.flatMap { failure -> (() -> Void)? in
        failure == .connection || restart != nil ? { retry(failure) } : nil
      })

    content(run)
      .announcesStatus(run.workingLabel)
      .taskThroughPush(id: Following(id: runID, connection: connection)) {
        failure = nil

        if let runID {
          let ending = await follow(runID)

          // A cancelled iteration ends like a finished stream: the wait went away or follows again.
          guard !Task.isCancelled else {
            return
          }

          await finish(ending)
        } else {
          await readMissingID()
        }
      }
  }

  private enum Ending {
    case ready
    /// Followed to its end, its result read on the way.
    case ended
    case stopped
    /// The stream broke and gave up reconnecting: the run may still be working.
    case lost
  }

  private func follow(_ id: String) async -> Ending {
    var current = GenerationWait(kind: kind).started
    wait = current

    do {
      for try await event in onboarding.events(generationID: id) {
        if let deckID = event.warmUpID {
          warmUpID = deckID
          onboarding.found(deckID: deckID, generationID: id)
        }

        let wasDone = current.isDone
        current.apply(event)
        wait = current

        if current.isDone, !wasDone {
          guard onRunEnd != nil else {
            return .ready
          }

          await read()
        }
      }

      return onRunEnd == nil ? .ready : .ended
    } catch is GenerationStopped {
      return .stopped
    } catch {
      return .lost
    }
  }

  private func finish(_ ending: Ending) async {
    switch ending {
    case .ready:
      await read()
    case .ended:
      onRunEnd?()
    case .stopped where restart != nil:
      failure = .generation
    case .stopped:
      await read()
    case .lost:
      failure = .connection
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

/// A wait on its own: its heading and the run's timeline, for the waits that deal no quiz.
struct GenerationWaitView<Leading: View, Trailing: View>: View {
  let title: LocalizedStringResource
  let description: LocalizedStringResource
  let generationID: String?
  let kind: GenerationWait.Kind
  var readGenerationID: (() async -> String?)?
  var restart: (() async throws -> String?)?
  let readResult: () async -> Bool
  @ViewBuilder var leading: () -> Leading
  @ViewBuilder var trailing: () -> Trailing

  var body: some View {
    GenerationFollower(
      generationID: generationID, kind: kind, readGenerationID: readGenerationID,
      restart: restart, readResult: readResult
    ) { run in
      ZoonkList {
        StepHeader(title: Text(title), description: Text(description))

        leading()

        Section {
          GenerationTimeline(
            wait: run.wait, failure: run.failure, isActing: run.isRestarting, act: run.retry)
        }
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)

        trailing()
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
    readResult: @escaping () async -> Bool,
    @ViewBuilder leading: @escaping () -> Leading
  ) {
    self.init(
      title: title, description: description, generationID: generationID, kind: kind,
      readResult: readResult, leading: leading, trailing: { EmptyView() })
  }
}

extension GenerationWaitView where Leading == EmptyView {
  init(
    title: LocalizedStringResource,
    description: LocalizedStringResource,
    generationID: String?,
    kind: GenerationWait.Kind,
    restart: (() async throws -> String?)? = nil,
    readResult: @escaping () async -> Bool,
    @ViewBuilder trailing: @escaping () -> Trailing
  ) {
    self.init(
      title: title, description: description, generationID: generationID, kind: kind,
      restart: restart, readResult: readResult, leading: { EmptyView() }, trailing: trailing)
  }
}

struct GenerationFailureSection: View {
  let failure: GenerationFailure
  var isActing = false
  let act: (() -> Void)?

  var body: some View {
    Section {
      GenerationFailureNotice(failure: failure, isActing: isActing, act: act)
    }
    .listRowBackground(Color.clear)
  }
}

/// Main's `GenerationFailureNotice`: what went wrong and its way out, in place of the wait's bar.
struct GenerationFailureNotice: View {
  let failure: GenerationFailure
  var isActing = false
  let act: (() -> Void)?

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      Image(
        systemName: failure == .connection ? "wifi.exclamationmark" : "exclamationmark.circle"
      )
      .foregroundStyle(.mutedForeground)
      .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 2) {
        title
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))

        Text(description)
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)

        if let act {
          Button(action: act) {
            action
          }
          .buttonStyle(.mainAction)
          .controlSize(.small)
          .disabled(isActing)
          .padding(.top, 8)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 12)
    .panel()
    .announcesAlert(description)
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

  private var description: String {
    switch failure {
    case .connection:
      String(
        localized: "We stopped getting updates. It may still be working.", table: "Onboarding",
        comment: "Why a wait stopped getting updates")
    case .generation:
      String(
        localized: "Something went wrong on our side.", table: "Onboarding",
        comment: "Why a run failed")
    case .notStarted:
      String(
        localized: "We couldn't get this started.", table: "Onboarding",
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

/// Main's `GenerationWait`: a bar split in the phases' usual times with how far it got, then each
/// phase with its clock and, while it runs, a line of what it's doing. A failure takes the bar's
/// place, and stops the clocks and lines.
struct GenerationTimeline<Header: View>: View {
  let wait: GenerationWait
  var failure: GenerationFailure?
  var isActing = false
  var act: (() -> Void)?
  @ViewBuilder var header: Header

  var body: some View {
    VStack(alignment: .leading, spacing: 24) {
      VStack(alignment: .leading, spacing: 12) {
        header

        if let failure {
          GenerationFailureNotice(failure: failure, isActing: isActing, act: act)
        } else {
          GenerationWaitBar(wait: wait)
        }
      }

      VStack(alignment: .leading, spacing: 10) {
        ForEach(wait.visiblePhases) { phase in
          GenerationPhaseRow(
            phase: phase, status: status(of: phase),
            isFollowing: failure == nil && !wait.isDone, clockOffset: wait.clockOffset)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  /// A failed run stops at the phase it was in; one that never started has nothing running.
  private func status(of phase: GenerationWait.Phase) -> GenerationPhaseRow.Status {
    switch (phase.state, failure) {
    case (.done, _): .done
    case (.waiting, _), (.working, .notStarted?): .waiting
    case (.working, .generation?): .failed
    case (.working, _): .working
    }
  }
}

extension GenerationTimeline where Header == EmptyView {
  init(
    wait: GenerationWait, failure: GenerationFailure? = nil, isActing: Bool = false,
    act: (() -> Void)? = nil
  ) {
    self.init(wait: wait, failure: failure, isActing: isActing, act: act) { EmptyView() }
  }
}

/// Main's `useAnimatedProgress`: between reports the bar drifts toward the end of the running
/// phases, never full before the work is, and never back unless the run started over.
private struct GenerationWaitBar: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  let wait: GenerationWait

  var body: some View {
    TimelineView(.animation(minimumInterval: 1, paused: wait.isDone)) { context in
      let shown = wait.shownShare(at: context.date)

      HStack(spacing: 12) {
        FilledParts(share: shown, weights: wait.visiblePhases.map(\.seconds))
          .animation(reduceMotion ? nil : .easeOut(duration: 0.7), value: wait.progress.share)

        Text(shown, format: .percent.precision(.fractionLength(0)))
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
          .frame(minWidth: 32, alignment: .trailing)
      }
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(Text(wait.kind.name))
      .accessibilityValue(Text(shown, format: .percent.precision(.fractionLength(0))))
    }
  }
}

extension GenerationWait.Kind {
  /// What the wait is for, as its bar and strip say it.
  var name: LocalizedStringResource {
    switch self {
    case .understanding:
      LocalizedStringResource(
        "Reading your goal", table: "Onboarding", comment: "VoiceOver: the bar of a wait")
        // A report eases the bar on; the drift between reports steps once a second, as the ring
        // does, so a wait left open isn't redrawn every frame.
    case .curriculum:
      LocalizedStringResource(
        "Building your plan", table: "Onboarding", comment: "VoiceOver: the bar of a wait")
    case .placement:
      LocalizedStringResource(
        "Getting your questions ready", table: "Onboarding",
        comment: "Title while placement questions are written")
    case .explanation:
      LocalizedStringResource(
        "Writing your explanation", table: "Onboarding", comment: "VoiceOver: the bar of a wait")
    case .levelTestBank:
      LocalizedStringResource(
        "Preparing your level test", table: "Onboarding", comment: "VoiceOver: the bar of a wait")
    case .lesson:
      LocalizedStringResource(
        "Writing your lesson", table: "Player", comment: "VoiceOver: the bar of a lesson's wait")
    }
  }
}

/// Each phase's part of the bar, as wide as its usual time, filled as far as the wait got.
private struct FilledParts: View, Animatable {
  var share: Double
  let weights: [Double]

  var animatableData: Double {
    get { share }
    set { share = newValue }
  }

  var body: some View {
    MeterParts(parts: parts, height: 4, gap: 3)
  }

  private var parts: [MeterParts.Part] {
    var reached = share * weights.reduce(0, +)

    return weights.map { weight in
      let fill = weight > 0 ? min(1, max(0, reached / weight)) : 0
      reached -= weight
      return MeterParts.Part(weight: weight, fill: .share(fill))
    }
  }
}

private struct GenerationPhaseRow: View {
  enum Status {
    case waiting
    case working
    case done
    case failed
  }

  let phase: GenerationWait.Phase
  let status: Status
  let isFollowing: Bool
  let clockOffset: TimeInterval?

  /// Main's 1rem mark column and 20pt line.
  @ScaledMetric(relativeTo: .subheadline) private var markWidth = 16.0
  @ScaledMetric(relativeTo: .subheadline) private var lineHeight = 20.0
  @ScaledMetric(relativeTo: .subheadline) private var dot = 8.0

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      mark
        .frame(width: markWidth, height: lineHeight)

      VStack(alignment: .leading, spacing: 2) {
        Text(phase.label)
          .typeStyle(isEmphasized ? TypeStyle.body.weight(.medium) : .body)
          .foregroundStyle(isEmphasized ? Color(.foreground) : .mutedForeground)
          .frame(minHeight: lineHeight)

        if status == .working, isFollowing {
          GenerationPhaseDetail(phase: phase)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      time
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)
        .frame(minHeight: lineHeight)
        .accessibilityHidden(true)
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(statusText)
  }

  private var isEmphasized: Bool {
    status == .working || status == .failed
  }

  @ViewBuilder
  private var mark: some View {
    switch status {
    case .waiting:
      Circle()
        .strokeBorder(.faint, lineWidth: 1)
        .frame(width: dot, height: dot)
    case .working:
      Circle()
        .fill(Color(.foreground))
        .frame(width: dot, height: dot)
    case .done:
      Image(systemName: "checkmark")
        .typeStyle(.body)
        .foregroundStyle(.faint)
    case .failed:
      Image(systemName: "exclamationmark.circle")
        .typeStyle(.body)
        .foregroundStyle(.destructiveText)
    }
  }

  @ViewBuilder
  private var time: some View {
    if let startedAt = phase.startedAt {
      if status == .done, let endedAt = phase.endedAt {
        Text(GenerationClock.text(endedAt.timeIntervalSince(startedAt)))
      } else if status == .working, isFollowing, let clockOffset {
        TimelineView(.periodic(from: .now, by: 1)) { context in
          Text(GenerationClock.text(context.date.timeIntervalSince(startedAt) - clockOffset))
        }
      }
    }
  }

  private var statusText: Text {
    switch status {
    case .waiting:
      Text(
        "Not started yet", tableName: "Onboarding",
        comment: "VoiceOver: a step of a wait that hasn't started")
    case .working:
      Text(
        "In progress", tableName: "Onboarding",
        comment: "VoiceOver: the step of a wait that's running")
    case .done:
      Text("Done", tableName: "Onboarding", comment: "A finished step of a wait")
    case .failed:
      Text(
        "Stopped here", tableName: "Onboarding",
        comment: "VoiceOver: the step of a wait where a failed run stopped")
    }
  }
}

/// A line of what the phase is doing, a new one every few seconds, or the newest skill it wrote.
private struct GenerationPhaseDetail: View {
  let phase: GenerationWait.Phase

  @State private var tick = 0

  var body: some View {
    Group {
      if let skillName = phase.skillName {
        Text(skillName)
          .lineLimit(1)
      } else if let line = phase.detailLine(tick: tick) {
        Text(line)
      }
    }
    .typeStyle(.meta)
    .foregroundStyle(.mutedForeground)
    .task {
      while !Task.isCancelled {
        do {
          try await Task.sleep(for: .milliseconds(Int.random(in: 2200...3600)))
        } catch {
          return
        }

        tick += 1
      }
    }
  }
}

enum GenerationClock {
  /// Main's `formatClock`: whole seconds rounded up, as "0:18" or "1:02:05".
  static func text(_ seconds: TimeInterval) -> String {
    let duration = Duration.seconds(max(0, seconds.rounded(.up)))
    return duration.formatted(
      .time(pattern: seconds >= 3600 ? .hourMinuteSecond : .minuteSecond))
  }
}
