import SwiftUI

/// A course's start (`/start/course/[courseId]`), where "Build my plan" on a Library course leads: the learner's level (a chapter's start doesn't ask: the plan starts at that chapter), then one button that starts the course as their goal (as a guest when there's no session) and goes on to the goal's own steps. Opening or leaving it creates nothing.
struct CourseStartScreen: View {
  let courseId: String
  var chapterId: String? = nil

  @Environment(CourseCatalogStore.self) private var catalog
  @Environment(OnboardingStore.self) private var onboarding
  @Environment(SessionStore.self) private var session
  @State private var level: String?
  @State private var isStarting = false
  @State private var error: GoalError?
  @State private var goalID: String?

  var body: some View {
    NavigationStack {
      if let goalID {
        GoalSetupContent(goalID: goalID)
      } else {
        form
          .closesTask()
      }
    }
  }

  private var form: some View {
    let course = catalog.course(id: courseId)

    return Form {
      if let chapterId {
        StepHeader(
          subject: course.value?.course.title,
          title: Text(course.value?.chapters.first { $0.id == chapterId }?.title ?? ""),
          description: Text(
            "Your plan starts at this chapter and follows the course from there, in the time you have each day.",
            tableName: "Onboarding", comment: "Under a chapter's title when a plan starts from it"))
      } else {
        StepHeader(
          subject: course.value?.course.title,
          title: Text(
            "How much do you already know?", tableName: "Onboarding", comment: "Onboarding question"
          ),
          description: Text(
            "It only changes where your plan starts.", tableName: "Onboarding",
            comment: "Under the level question"))

        ChoiceRows(
          choices: LevelChoices.all,
          picked: level
        ) { level = $0 }
      }

      if let error {
        GoalErrorSection(error: error)
      }

      if error?.needsAccount != true, error?.limit?.isPlusLimit != true {
        StepButtons(
          canContinue: (chapterId != nil || level != nil) && !isStarting,
          continueLabel: isStarting
            ? Text(
              "Starting your plan…", tableName: "Onboarding",
              comment: "While a course starts as a goal")
            : Text(
              "Build my plan", tableName: "Onboarding",
              comment: "Starts a course as the learner's goal"),
          note: session.authenticatedSession == nil
            ? Text(
              "Start free, no account needed.", tableName: "Onboarding",
              comment: "Under a course's Build my plan for a visitor")
            : nil,
          onContinue: start)
      }
    }
    .loads(course, refreshable: false)
  }

  private func start() {
    guard chapterId != nil || level != nil, !isStarting else {
      return
    }

    isStarting = true
    error = nil

    Task {
      defer { isStarting = false }

      do {
        goalID = try await onboarding.startCourse(
          courseID: courseId, chapterID: chapterId, level: level.flatMap(LevelChoices.answer))
      } catch is CancellationError {
        // The write is obsolete: the learner who asked is gone, so nothing shows.
      } catch {
        self.error = GoalError.creating(error)
      }
    }
  }
}
