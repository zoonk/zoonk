import SwiftUI

struct CoursePlanSections: View {
  let chapters: [CourseChapter]
  let estimate: CoursePlanEstimate
  let exam: CoursePlanExample.Exam?
  let isExam: Bool
  let minutes: Int

  var body: some View {
    Section {
      switch estimate.reach {
      case .toEnd(let weeks, let endDate, _):
        UndatedHeadline(
          endDate: endDate, fromDate: estimate.fromDate, minutes: minutes, weeks: weeks)
      case .byDate(let fitting, let published, let areas):
        DatedHeadline(
          areas: areas, date: exam?.days.first.flatMap(catalogDay) ?? "", estimate: estimate,
          fitting: fitting, minutes: minutes, published: published)
      }
    } header: {
      Text("Example plan", tableName: "Courses", comment: "Header of a course's example plan")
    }

    if case .toEnd(_, _, let firstDay) = estimate.reach, !firstDay.isEmpty {
      PlanWorkloadSection(estimate: estimate, isExam: isExam, showsCaption: false)
      PlanFirstDay(chapters: chapters, lessons: firstDay)
    } else {
      PlanWorkloadSection(estimate: estimate, isExam: isExam, showsCaption: true)
    }
  }
}

private struct PlanCaption: View {
  var body: some View {
    Text(
      "An example. Your plan follows your answers, so it can start later and end sooner.",
      tableName: "Courses", comment: "Caption of a course's example plan")
  }
}

private func planReadout(_ text: AttributedString, number: String) -> AttributedString {
  var readout = text
  readout.font = .title3.weight(.medium)
  readout.foregroundColor = .secondary

  if let range = readout.range(of: number) {
    readout[range].font = .largeTitle.weight(.semibold).monospacedDigit()
    readout[range].foregroundColor = .primary
  }

  return readout
}

private struct UndatedHeadline: View {
  /// A plan ending within this many days names no month: its weeks already say when.
  private static let nearDays = 42

  let endDate: String?
  let fromDate: String
  let minutes: Int
  let weeks: Int

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(
        planReadout(
          AttributedString(
            localized: "~\(weeks) weeks", table: "Courses",
            comment: "How many weeks a course's example plan takes"),
          number: "~\(weeks.formatted())"))

      Text(
        "to finish the whole course at \(minutes) minutes a day, Monday to Friday, from scratch.",
        tableName: "Courses", comment: "Under the weeks a course's example plan takes"
      )
      .foregroundStyle(.secondary)

      if let endMonth {
        Label {
          Text(
            "Starting today, you'd finish around \(Text(endMonth).bold()).", tableName: "Courses",
            comment: "When a course's example plan ends: a month and year")
        } icon: {
          Image(systemName: "flag")
            .foregroundStyle(.secondary)
        }
        .padding(.top, 4)
      }
    }
    .padding(.vertical, 4)
  }

  private var endMonth: String? {
    let style = Date.ISO8601FormatStyle(timeZone: .gmt).year().month().day()

    guard
      let endDate, let end = try? style.parse(endDate), let start = try? style.parse(fromDate),
      end.timeIntervalSince(start) > Double(Self.nearDays) * 86_400
    else {
      return nil
    }

    var format = Date.FormatStyle.dateTime.month(.wide).year()
    format.timeZone = .gmt
    return end.formatted(format)
  }
}

/// Never how much fits: that share depends on the learner's level and time, which onboarding asks.
private struct DatedHeadline: View {
  let areas: [CoursePlanEstimate.Area]
  let date: String
  let estimate: CoursePlanEstimate
  let fitting: Int
  let minutes: Int
  let published: Int

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      let studyTime = catalogDurationText(minutes: Int(estimate.studyMinutes.rounded()))

      Text(
        planReadout(
          AttributedString(
            localized: "\(studyTime) of study", table: "Courses",
            comment: "The study time an exam course's example plan has by the exam"),
          number: studyTime))

      holds
        .foregroundStyle(.secondary)

      if let coverage = estimate.coverage {
        fit(coverage)
          .foregroundStyle(.secondary)
      }
    }
    .padding(.vertical, 4)
  }

  private var time: String {
    studyDuration(minutes: minutes)
  }

  @ViewBuilder
  private var holds: some View {
    if estimate.unwrittenLessonMinutes > 0 {
      if fitting == 0 {
        Text(
          "by \(date), at \(time) a day, Monday to Friday, what comes up most first: lessons written as you reach them.",
          tableName: "Courses",
          comment:
            "What an exam course's example plan holds with no written lessons; the arguments are a date like 'May 5' and a duration like '30 min'"
        )
      } else {
        Text(
          "by \(date), at \(time) a day, Monday to Friday, what comes up most first: \(fitting) lessons already in the course, and more written as you reach them.",
          tableName: "Courses",
          comment:
            "What an exam course's example plan holds; the arguments are a date like 'May 5' and a duration like '30 min'"
        )
      }
    } else if fitting == 0 || areas.contains(where: { $0.quickLessons > 0 }) {
      Text(
        "by \(date), at \(time) a day, Monday to Friday, in quick lessons on what comes up most. The full lessons come once there's more time.",
        tableName: "Courses", comment: "What an exam course's example plan holds in quick lessons")
    } else {
      Text(
        "by \(date), at \(time) a day, Monday to Friday, what comes up most first: \(fitting.formatted()) of the course's \(published) lessons.",
        tableName: "Courses", comment: "What an exam course's example plan holds of its lessons")
    }
  }

  @ViewBuilder
  private func fit(_ coverage: CoursePlanEstimate.Coverage) -> some View {
    if coverage.coveredShare < 1 {
      Text(
        "Not all of it fits by then. Before you start, you see how much fits at your level and your time.",
        tableName: "Courses", comment: "An exam course's example plan doesn't cover everything")
    } else if coverage.measuresGoal {
      Text(
        "That's every topic in the course, in depth.", tableName: "Courses",
        comment: "An example plan covers the whole course")
    } else {
      Text(
        "That's every exam topic in the course, in depth.", tableName: "Courses",
        comment: "An exam course's example plan covers every exam topic")
    }
  }
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
          "+ \(folded.count) more lessons · \(studyDuration(minutes: Int(minutes(of: folded).rounded())))",
          tableName: "Courses", comment: "The rest of an example plan's first day, folded"
        )
        .font(.footnote.monospacedDigit())
        .foregroundStyle(.secondary)
      }
    } header: {
      CatalogSectionHeader {
        Text("Today", tableName: "Courses", comment: "Header of an example plan's first day")
      } detail: {
        Text(
          "\(lessons.count) lessons · \(studyDuration(minutes: Int(minutes(of: lessons[...]).rounded())))",
          tableName: "Courses",
          comment: "How many lessons an example plan's first day has, and how long")
      }
    } footer: {
      PlanCaption()
    }
  }

  private func minutes(of lessons: ArraySlice<CoursePlanEstimate.FirstDayLesson>) -> Double {
    lessons.reduce(0) { $0 + $1.dayMinutes }
  }
}

private struct PlanWorkloadSection: View {
  let estimate: CoursePlanEstimate
  let isExam: Bool
  let showsCaption: Bool

  var body: some View {
    let parts = self.parts

    if !parts.isEmpty {
      Section {
        if parts.count > 1 {
          MeterParts(
            parts: parts.map { MeterParts.Part(weight: $0.minutes, fill: .color($0.fill)) }
          )
          .padding(.vertical, 6)
        }

        ForEach(parts, id: \.id) { part in
          LabeledContent {
            Text(catalogDurationText(minutes: Int(part.minutes.rounded())))
              .monospacedDigit()
          } label: {
            HStack(spacing: 8) {
              HStack(spacing: 2) {
                ForEach(part.kinds, id: \.systemImage) { KindMark(kind: $0) }
              }

              Text(part.label)
            }
          }
        }
      } header: {
        CatalogSectionHeader {
          Text(
            "What fills the time", tableName: "Courses",
            comment: "Header of an example plan's workload")
        } detail: {
          if parts.count > 1 {
            Text(
              "\(catalogDurationText(minutes: Int(estimate.scheduledMinutes.rounded()))) in all",
              tableName: "Courses", comment: "An example plan's whole time")
          }
        }
      } footer: {
        VStack(alignment: .leading, spacing: 6) {
          if estimate.workload.practiceMinutes.rounded() > 0 {
            Text(
              "What you studied comes back right before you'd forget it.", tableName: "Courses",
              comment: "Why an example plan has reviews")
          }

          if let after = estimate.afterDeadlineMinutes, after.rounded() > 0 {
            Text(
              "Of this, \(catalogDurationText(minutes: Int(after.rounded()))) comes after the exam.",
              tableName: "Courses", comment: "How much of an exam plan's time comes after the exam")
          }

          if estimate.workload.unwrittenLessonMinutes > 0 {
            Text(
              "Lessons not written yet are written as you reach them.", tableName: "Courses",
              comment: "Under an example plan with lessons still to be written")
          }

          if showsCaption {
            PlanCaption()
          }
        }
      }
    }
  }

  private struct Part {
    let fill: Color
    let id: String
    let kinds: [LearnKind]
    let label: LocalizedStringResource
    let minutes: Double
  }

  private var parts: [Part] {
    let workload = estimate.workload

    return [
      Part(
        fill: Color(.secondaryLabel), id: "lessons", kinds: [.lesson],
        label: LocalizedStringResource(
          "Lessons", table: "Courses", comment: "A part of an example plan's time"),
        minutes: workload.lessonMinutes),
      Part(
        fill: Color(.tertiaryLabel), id: "unwritten", kinds: [.lesson],
        label: LocalizedStringResource(
          "Lessons not written yet", table: "Courses", comment: "A part of an example plan's time"),
        minutes: workload.unwrittenLessonMinutes),
      Part(
        fill: LearnKind.review.color, id: "practice", kinds: [.review],
        label: LocalizedStringResource(
          "Reviews and practice", table: "Courses", comment: "A part of an example plan's time"),
        minutes: workload.practiceMinutes),
      Part(
        fill: LearnKind.challenge.color, id: "checkpoints",
        kinds: isExam ? [.challenge, .mock] : [.challenge],
        label: isExam
          ? LocalizedStringResource(
            "Challenges and mock exams", table: "Courses",
            comment: "A part of an exam plan's time")
          : LocalizedStringResource(
            "Challenges", table: "Courses", comment: "A part of an example plan's time"),
        minutes: workload.checkpointMinutes),
    ]
    .filter { $0.minutes.rounded() > 0 }
  }
}
