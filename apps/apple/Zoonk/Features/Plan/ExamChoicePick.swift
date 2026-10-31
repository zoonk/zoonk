import Foundation

extension GoalPlan.ExamChoice {
  var pickedName: String? {
    options.first { $0.name == subject }.map { $0.shortName ?? $0.name }
  }

  /// Main's `PlanChoiceLines`.
  var followingLine: String? {
    pickedName.map { name in
      String(
        localized: "Following the \(name) syllabus", table: "Onboarding",
        comment:
          "The option of an exam's choice the learner's plan studies, such as a specialty (Desenvolvimento de Sistemas) or a foreign language, named as the exam's notice names it"
      )
    }
  }
}
