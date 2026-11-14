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
    if let words = moment.words {
      Section {
        Label {
          VStack(alignment: .leading, spacing: 4) {
            Text(words.title).typeStyle(.body.weight(.semibold))
            if let day = moment.dayLine {
              Text(verbatim: day)
                .typeStyle(.data)
            }
            if let body = words.body {
              Text(body)
                .foregroundStyle(.mutedForeground)
            }
          }
        } icon: {
          Image(systemName: moment.icon)
        }

        ExamChecklistRows(moment: moment, checked: $checked)

        action
      } footer: {
        SectionFooter {
          if let tools = moment.toolsLine {
            Text(tools)
          }
        }
      }
    }
  }
}

/// The exam day's checklist, its tally then one row an item, ticked in place.
struct ExamChecklistRows: View {
  let moment: ExamMoment
  @Binding var checked: Set<ExamView.ChecklistItem>

  var body: some View {
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
          Text(moment.checklistLabel(item))
        } icon: {
          Image(systemName: isDone ? "checkmark.circle.fill" : "circle")
            .foregroundStyle(isDone ? AnyShapeStyle(.success) : AnyShapeStyle(.mutedForeground))
        }
      }
      .tint(.primary)
      .accessibilityAddTraits(isDone ? .isSelected : [])
    }
  }

  private var tally: String {
    String(
      localized: "\(checked.intersection(moment.checklist).count) of \(moment.checklist.count)",
      table: "Exam", comment: "Checklist items ticked off of all of them")
  }
}

extension ExamMoment {
  /// The exam's date and start time, until it's over.
  var dayLine: String? {
    guard stage != .afterExam, let day, let date = studyDate(day.date) else {
      return nil
    }

    return [
      date.formatted(.studyDay.weekday(.wide).month(.wide).day().year()),
      day.startTime.flatMap(examTimeOfDay),
    ].compactMap(\.self).joinedFacts()
  }

  /// Under the checklist, the tools the exam allows.
  var toolsLine: String? {
    checklist.isEmpty || tools.isEmpty
      ? nil
      : String(
        localized: "What you may use: \(tools.formatted(.list(type: .and)))", table: "Exam",
        comment: "The tools the exam allows")
  }

  var icon: String {
    switch stage {
    case .afterExam: "questionmark.bubble"
    case .dayBefore: "moon"
    case .examDay: "calendar"
    default: "flag"
    }
  }

  /// Nil while it says nothing: before the final stretch, and once the result is in.
  var words: (title: String, body: String?)? {
    switch stage {
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
          localized: "\(examName) is tomorrow", table: "Exam", comment: "The day before"),
        work
      )
    case .examDay:
      (
        String(localized: "\(examName) is today", table: "Exam", comment: "Exam day"),
        work
      )
    case .afterExam where !resultReported:
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
      sessionsDone > 0
        ? String(
          localized: "\(sessionsDone) days of study", table: "Exam",
          comment: "Days the learner studied before the exam, in \"… done.\"")
        : nil,
      mocksTaken > 0
        ? String(
          localized: "\(mocksTaken) mock exams", table: "Exam",
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
      prepared
      ? String(localized: "You've prepared for this.", table: "Exam", comment: "Prepared") : nil
    let sentences = [prepared, done].compactMap(\.self)

    return sentences.isEmpty ? nil : sentences.joinedSentences()
  }

  func checklistLabel(_ item: ExamView.ChecklistItem) -> String {
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
