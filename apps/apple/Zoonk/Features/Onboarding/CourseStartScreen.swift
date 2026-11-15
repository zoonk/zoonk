import SwiftUI

/// Opening or leaving it creates nothing.
struct CourseStartScreen: View {
  let courseId: String
  var chapterId: String? = nil

  @Environment(AppRouter.self) private var router
  @Environment(CourseCatalogStore.self) private var catalog
  @Environment(OnboardingStore.self) private var onboarding
  @Environment(SessionStore.self) private var session
  @State private var level: String?
  @State private var isStarting = false
  @State private var startTask: Task<Void, Never>?
  @State private var error: GoalError?
  @State private var goalID: String?

  var body: some View {
    NavigationStack {
      if let goalID {
        GoalSetupContent(goalID: goalID)
      } else {
        form
          .onboardingColumn()
          .closesTask()
          .barName(title)
      }
    }
  }

  private var title: Text {
    if let course = catalog.course(id: courseId).value?.course {
      Text(
        "Start \(course.title)", tableName: "Onboarding",
        comment: "Names the screen that starts a course as a goal; the argument is the course")
    } else {
      Text(
        "Start a course", tableName: "Onboarding",
        comment: "Names the screen that starts a course as a goal, until the course loads")
    }
  }

  private var form: some View {
    let course = catalog.course(id: courseId)

    return ZoonkList {
      OpeningClock(availableAt: error?.limit?.availableAt) { now in
        if let gate = gate(at: now) {
          // Main's: the course stays the subject, the limit is the heading, and the bar holds the
          // way on, so nothing is left to choose.
          StepHeader(subject: subject, title: gate.title, description: gate.line)
            .announcesAlert(gate.said)
        } else {
          start(course: course.value)
        }
      }
    }
    .bottomBar {
      OpeningClock(availableAt: error?.limit?.availableAt) { now in
        if gate(at: now) != nil {
          gateActions
        } else if error?.needsAccount != true {
          StepButtons(
            canContinue: chapterId != nil || level != nil,
            continueLabel: Text(
              "Build my plan", tableName: "Onboarding",
              comment: "Starts a course as the learner's goal"),
            onContinue: start
          )
          .environment(\.isSavingAnswer, isStarting)
        }
      }
    }
    .loads(course, refreshable: false)
    .onDisappear {
      startTask?.cancel()
    }
  }

  @ViewBuilder
  private func start(course: CourseDetail?) -> some View {
    if let chapterId {
      StepHeader(
        subject: course?.course.title,
        title: Text(course?.chapters.first { $0.id == chapterId }?.title ?? ""),
        description: Text(
          "Your plan starts at this chapter and follows the course from there, in the time you have each day.",
          tableName: "Onboarding", comment: "Under a chapter's title when a plan starts from it"))
    } else {
      StepHeader(
        subject: course?.course.title,
        title: Text(
          "How much do you already know?", tableName: "Onboarding", comment: "Onboarding question"
        ),
        description: nil)

      ChoiceRows(
        choices: LevelChoices.all(testMinutes: course?.course.quickTestMinutes),
        picked: level
      ) { level = $0 }
    }

    if let error {
      GoalErrorSection(error: error, replacesStart: true)
    }

    if session.authenticatedSession == nil {
      Text(
        "Start free, no account needed.", tableName: "Onboarding",
        comment: "Under a course's Build my plan for a visitor"
      )
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
      .listRowSeparator(.hidden)
    }
  }

  /// The course, or the chapter the plan would start from.
  private var subject: String? {
    let course = catalog.course(id: courseId).value

    return chapterId.flatMap { id in course?.chapters.first { $0.id == id }?.title }
      ?? course?.course.title
  }

  /// A limit only subscribing lifts takes the start's place while it holds: its words head the
  /// screen.
  private func gate(at now: Date) -> CourseStartGate? {
    guard let limit = error?.limit, limit.holdsStart(at: now) else {
      return nil
    }

    if case .monthlyGoals(let help) = limit {
      let words = help.words(.goals, now: now)

      return CourseStartGate(
        title: words.title.map { Text($0) } ?? Text(verbatim: subject ?? ""),
        line: words.line.map { Text($0) }, said: words.said)
    }

    return CourseStartGate(
      title: Text(
        "That's all the goals you can study at once", tableName: "Onboarding",
        comment:
          "A free learner studies as many goals at once as their plan allows; it's about goals at the same time, not new goals started per day or month"
      ),
      line: Text(
        "Pause one in your Plan, or subscribe to study more at once.", tableName: "Onboarding",
        comment: "Pausing a goal keeps its progress"),
      said: String(localized: limit.message))
  }

  @ViewBuilder private var gateActions: some View {
    if error?.limit == .activeGoals {
      Button {
        router.showRoot(of: .plan)
      } label: {
        Text(
          "Go to your Plan", tableName: "Onboarding",
          comment: "Opens the Plan, whose menu pauses a goal and keeps its progress")
      }
      .buttonStyle(.outline)
    }

    SubscribeButton()
      .buttonStyle(.mainAction)
  }

  private func start() {
    guard chapterId != nil || level != nil, !isStarting else {
      return
    }

    isStarting = true
    error = nil

    startTask = Task {
      defer { isStarting = false }

      do {
        goalID = try await onboarding.startCourse(
          courseID: courseId, chapterID: chapterId, level: level.flatMap(LevelChoices.answer))
      } catch is CancellationError {
      } catch {
        self.error = GoalError.creating(error)
      }
    }
  }
}

private struct CourseStartGate {
  let title: Text
  let line: Text?
  let said: String
}
