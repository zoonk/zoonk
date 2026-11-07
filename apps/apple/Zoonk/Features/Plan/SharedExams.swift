import SwiftUI

// Mirrors main's `shared-exams.tsx`.

private let namedExams = 2

private func examNames(_ exams: [GoalSyllabus.SharedExam]) -> String {
  exams.map(\.name).formatted(.list(type: .and))
}

/// Under an exam's Subjects title: the learner's other exams share some of its topics.
struct SharedExamsNote: View {
  let exams: [GoalSyllabus.SharedExam]

  var body: some View {
    if !exams.isEmpty {
      SectionFooter {
        Text(
          verbatim: [
            sharing,
            String(
              localized: "Practice stays in each exam's style.", table: "Plan",
              comment: "On one exam's plan, after saying which topics it shares with other exams"),
          ].joinedSentences())
      }
    }
  }

  private var sharing: String {
    if exams.count > namedExams {
      return String(
        localized:
          "Topics shared with your \(exams.count) other exams count for every exam that has them, so you study them once.",
        table: "Plan",
        comment:
          "On one exam's plan, when the learner has several other exams that test some of the same topics"
      )
    }

    let names = examNames(exams)

    return exams.count == 1
      ? String(
        localized: "Topics shared with \(names) count for both exams, so you study them once.",
        table: "Plan",
        comment:
          "On one exam's plan. The name is the learner's other exam that tests some of the same topics"
      )
      : String(
        localized:
          "Topics shared with \(names) count for every exam that has them, so you study them once.",
        table: "Plan",
        comment:
          "On one exam's plan. The names are the learner's other exams that test some of the same topics"
      )
  }
}

/// Under a subject: the learner's other exams that also test it.
struct AlsoInExams: View {
  let exams: [GoalSyllabus.SharedExam]

  var body: some View {
    if !exams.isEmpty {
      Group {
        if exams.count > namedExams {
          Text(
            "Also in \(exams.count) exams", tableName: "Plan",
            comment: "Marks a subject on one exam's plan that the learner's other exams also test")
        } else {
          Text(
            "Also in \(examNames(exams))", tableName: "Plan",
            comment:
              "Marks a subject on one exam's plan that the learner's other exams, named here, also test"
          )
        }
      }
      .typeStyle(.meta)
      .foregroundStyle(.mutedForeground)
    }
  }
}
