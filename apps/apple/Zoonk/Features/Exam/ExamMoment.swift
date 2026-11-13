import SwiftUI

/// Main's `ExamMomentView`: the exam's last days and "How did it go?", for the Exam screen and
/// Today.
struct ExamMoment: Hashable, Decodable, Sendable {
  var checklist: [ExamView.ChecklistItem]
  var day: ExamView.Day?
  var examName: String
  var mocksTaken: Int
  var prepared: Bool
  var resultReported: Bool
  var sessionsDone: Int
  var stage: ExamView.Stage
  var tools: [String]
}

extension ExamView {
  /// The Exam screen takes the result in its own section, so it never asks how it went.
  var moment: ExamMoment {
    ExamMoment(
      checklist: stage == .dayBefore || stage == .examDay ? checklist : [], day: days.first,
      examName: examName, mocksTaken: mocks.count, prepared: prepared,
      resultReported: true, sessionsDone: sessionsDone, stage: stage, tools: tools)
  }
}

/// Calm, and never a promise.
struct ExamMomentSection<Action: View>: View {
  let moment: ExamMoment
  /// Main's checklist saves nothing: a calm reminder, kept above the panes while the learner stays.
  @Binding var checked: Set<ExamView.ChecklistItem>
  @ViewBuilder var action: Action

  var body: some View {
    if let copy {
      Section {
        Label {
          VStack(alignment: .leading, spacing: 4) {
            Text(copy.title).typeStyle(.body.weight(.semibold))
            if moment.stage != .afterExam, let day = moment.day, let date = studyDate(day.date) {
              Text(
                verbatim: [
                  date.formatted(.studyDay.weekday(.wide).month(.wide).day().year()),
                  day.startTime.flatMap(examTimeOfDay),
                ].compactMap(\.self).joinedFacts()
              )
              .typeStyle(.data)
            }
            if let body = copy.body {
              Text(body)
                .foregroundStyle(.mutedForeground)
            }
          }
        } icon: {
          Image(systemName: icon)
        }

        if !moment.checklist.isEmpty {
          LabeledContent {
            Text(tally)
              .monospacedDigit()
          } label: {
            Text("For exam day", tableName: "Exam", comment: "Title of the exam day's checklist")
          }
          .typeStyle(.body)
          .announcesStatus(tally)
        }

        ForEach(moment.checklist, id: \.self) { item in
          let isDone = checked.contains(item)

          Button {
            if isDone {
              checked.remove(item)
            } else {
              checked.insert(item)
            }
          } label: {
            Label {
              Text(checklistLabel(item))
            } icon: {
              Image(systemName: isDone ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(isDone ? AnyShapeStyle(.success) : AnyShapeStyle(.mutedForeground))
            }
          }
          .tint(.primary)
          .accessibilityAddTraits(isDone ? .isSelected : [])
        }

        action
      } footer: {
        SectionFooter {
          if !moment.checklist.isEmpty, !moment.tools.isEmpty {
            Text(
              "What you may use: \(moment.tools.formatted(.list(type: .and)))", tableName: "Exam",
              comment: "The tools the exam allows")
          }
        }
      }
    }
  }

  private var tally: String {
    String(
      localized: "\(checked.intersection(moment.checklist).count) of \(moment.checklist.count)",
      table: "Exam", comment: "Checklist items ticked off of all of them")
  }

  private var icon: String {
    switch moment.stage {
    case .afterExam: "questionmark.bubble"
    case .dayBefore: "moon"
    case .examDay: "calendar"
    default: "flag"
    }
  }

  private var copy: (title: String, body: String?)? {
    switch moment.stage {
    case .finalStretch:
      (
        String(localized: "The final stretch", table: "Exam", comment: "The exam's last weeks"),
        String(
          localized: "From now on, review and mock exams.", table: "Exam",
          comment: "What the final stretch does")
      )
    case .dayBefore:
      (
        String(
          localized: "\(moment.examName) is tomorrow", table: "Exam", comment: "The day before"),
        work
      )
    case .examDay:
      (
        String(localized: "\(moment.examName) is today", table: "Exam", comment: "Exam day"),
        work
      )
    case .afterExam where !moment.resultReported:
      (
        String(
          localized: "How did it go?", table: "Exam",
          comment: "Asks how the exam went, once it's over"),
        String(
          localized: "Add your official result when it comes out.", table: "Exam",
          comment: "Asks for the official result once the exam is over")
      )
    case .preparing, .afterExam:
      nil
    }
  }

  /// Today's list shows today's work, so the day before and exam day say only what was done.
  private var work: String? {
    let parts = [
      moment.sessionsDone > 0
        ? String(
          localized: "\(moment.sessionsDone) days of study", table: "Exam",
          comment: "Days the learner studied before the exam, in \"… done.\"")
        : nil,
      moment.mocksTaken > 0
        ? String(
          localized: "\(moment.mocksTaken) mock exams", table: "Exam",
          comment: "Mock exams the learner took before the exam, in \"… done.\"")
        : nil,
    ].compactMap(\.self)

    let done =
      parts.isEmpty
      ? nil
      : String(
        localized: "\(parts.formatted(.list(type: .and))) done.", table: "Exam",
        comment: "What the learner did before the exam: days of study, mock exams or both")
    let prepared =
      moment.prepared
      ? String(localized: "You've prepared for this.", table: "Exam", comment: "Prepared") : nil
    let sentences = [prepared, done].compactMap(\.self)

    return sentences.isEmpty ? nil : sentences.joinedSentences()
  }

  private func checklistLabel(_ item: ExamView.ChecklistItem) -> String {
    switch item {
    case .documents:
      String(
        localized: "Photo ID and your registration card", table: "Exam", comment: "Checklist")
    case .blackPen:
      String(localized: "A black pen with a clear barrel", table: "Exam", comment: "Checklist")
    case .route:
      String(localized: "Your route there, with time to spare", table: "Exam", comment: "Checklist")
    case .examTime:
      String(
        localized: "When the gates close and the exam starts", table: "Exam", comment: "Checklist")
    case .sleep:
      String(localized: "A good night's sleep", table: "Exam", comment: "Checklist")
    case .materials:
      String(
        localized: "What your teacher lets you bring, like a pen or a calculator", table: "Exam",
        comment: "Checklist")
    }
  }
}

/// An exam's start time, as its notice gives it.
func examTimeOfDay(_ text: String) -> String? {
  let parts = text.split(separator: ":").compactMap { Int($0) }
  guard parts.count >= 2,
    let date = Calendar(identifier: .gregorian).date(
      from: DateComponents(
        timeZone: .gmt, year: 2000, month: 1, day: 1, hour: parts[0], minute: parts[1]))
  else {
    return nil
  }

  var style = Date.FormatStyle(timeZone: .gmt).hour().minute()
  style.calendar.timeZone = .gmt
  return date.formatted(style)
}
