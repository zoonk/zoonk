import SwiftUI

/// Only a course read to its end: an exam course's first screen already says the exam's date and
/// that the plan runs until it, and how much fits depends on the learner's own time.
struct CoursePlanSections: View {
  let chapters: [CourseChapter]
  let firstDay: [CoursePlanEstimate.FirstDayLesson]
  let minutes: Int
  let weeks: Int

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          planReadout(
            AttributedString(
              localized: "~\(weeks) weeks", table: "Courses",
              comment: "How many weeks a course's plan takes"),
            number: "~\(weeks.formatted())"))

        Text(
          "Studying \(minutes) minutes a day. Your plan skips what you already know, so it can take less.",
          tableName: "Courses", comment: "Under the weeks a course's plan takes"
        )
        .foregroundStyle(.mutedForeground)
      }
      .padding(.vertical, 4)
    } header: {
      SectionTitle(
        Text(
          "How long it takes", tableName: "Courses",
          comment: "Header of how long a course takes to finish"))
    }

    if !firstDay.isEmpty {
      PlanFirstDay(chapters: chapters, lessons: firstDay)
    }
  }
}

private func planReadout(_ text: AttributedString, number: String) -> AttributedString {
  var readout = text
  readout.font = .title3.weight(.medium)
  readout.foregroundColor = .mutedForeground

  if let range = readout.range(of: number) {
    readout[range].font = .largeTitle.weight(.semibold).monospacedDigit()
    readout[range].foregroundColor = .primary
  }

  return readout
}

private struct PlanFirstDay: View {
  private static let shown = 3

  let chapters: [CourseChapter]
  let lessons: [CoursePlanEstimate.FirstDayLesson]

  var body: some View {
    let folded = lessons.dropFirst(Self.shown)

    Section {
      ForEach(lessons.prefix(Self.shown)) { lesson in
        LabeledContent {
          Text(studyDuration(minutes: Int(lesson.dayMinutes.rounded())))
            .monospacedDigit()
        } label: {
          Text(lesson.title)

          if let chapter = chapters.first(where: { $0.id == lesson.chapterID }) {
            Text(chapter.title)
          }
        }
      }

      if !folded.isEmpty {
        Text(
          "+ \(folded.count) more lessons\u{00A0}· \(studyDuration(minutes: Int(minutes(of: folded).rounded())))",
          tableName: "Courses", comment: "The rest of an example plan's first day, folded"
        )
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)
      }
    } header: {
      SectionTitle(
        Text(
          "Your first day", tableName: "Courses",
          comment: "Header of the lessons a course's plan starts with")
      ) {
        Text(
          "\(lessons.count) lessons\u{00A0}· \(studyDuration(minutes: Int(minutes(of: lessons[...]).rounded())))",
          tableName: "Courses",
          comment: "How many lessons an example plan's first day has, and how long")
      }
    }
  }

  private func minutes(of lessons: ArraySlice<CoursePlanEstimate.FirstDayLesson>) -> Double {
    lessons.reduce(0) { $0 + $1.dayMinutes }
  }
}
