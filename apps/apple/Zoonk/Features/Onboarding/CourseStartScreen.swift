import SwiftUI

/// Opening or leaving it creates nothing.
struct CourseStartScreen: View {
  let courseId: String
  var chapterId: String? = nil

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

  /// The course opened; a start in the app's language may use another version of it.
  private var startLanguage: CourseStartLanguage {
    catalog.course(id: courseId).value?.course.startLanguage(in: catalog.language) ?? .same
  }

  /// The course the start uses: its version in the app's language when there is one, so the
  /// learner never sees the other language's.
  private var startCourseID: String {
    if case .edition(let edition) = startLanguage { edition.id } else { courseId }
  }

  /// A version in another language has other chapters, and a plan in the app's language doesn't
  /// follow this course's.
  private var startChapterID: String? {
    startLanguage == .same ? chapterId : nil
  }

  private var title: Text {
    if let course = catalog.course(id: startCourseID).value?.course {
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
    let course = catalog.course(id: startCourseID)

    return ZoonkList {
      OpeningClock(availableAt: error?.limit?.availableAt) { now in
        if let gate = GoalLimitGate(error?.limit, at: now, subject: subject) {
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
        if let limit = error?.limit, GoalLimitGate(limit, at: now) != nil {
          GoalLimitActions(limit: limit)
        } else if error?.needsAccount != true {
          StepButtons(
            canContinue: startChapterID != nil || level != nil,
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
    if let chapterId = startChapterID {
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
        description: languageNote)

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

  /// Main's: a course with no version in the app's language says the lessons will be in it.
  private var languageNote: Text? {
    guard case .learnerLanguage(let language) = startLanguage,
      let course = catalog.course(id: courseId).value?.course
    else {
      return nil
    }

    return Text(
      "This course is in \(Locale.current.languageName(course.language)). Your lessons will be in \(Locale.current.languageName(language)).",
      tableName: "Onboarding",
      comment:
        "Under the level question when a course's language isn't the app's. Both placeholders are language names, as they're written mid-sentence"
    )
  }

  /// The course, or the chapter the plan would start from.
  private var subject: String? {
    let course = catalog.course(id: startCourseID).value

    return startChapterID.flatMap { id in course?.chapters.first { $0.id == id }?.title }
      ?? course?.course.title
  }

  private func start() {
    guard startChapterID != nil || level != nil, !isStarting else {
      return
    }

    isStarting = true
    error = nil

    startTask = Task {
      defer { isStarting = false }

      do {
        goalID = try await onboarding.startCourse(
          courseID: startCourseID, chapterID: startChapterID,
          level: level.flatMap(LevelChoices.answer), language: catalog.language)
      } catch is CancellationError {
      } catch {
        self.error = GoalError.creating(error)
      }
    }
  }
}
