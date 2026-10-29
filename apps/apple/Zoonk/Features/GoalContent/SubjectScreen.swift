import SwiftUI

struct SubjectScreen: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var plans
  @State private var isReporting = false

  let subjectKey: String

  var body: some View {
    if let goal = learner.summary.value?.shownGoal {
      let syllabus = plans.syllabus(goalId: goal.id)
      let subject = syllabus.value?.subjects.first { $0.key == subjectKey }

      Group {
        if let subject {
          SubjectContent(goal: goal, subject: subject)
        } else {
          switch syllabus.state {
          case .idle, .loading:
            ProgressView()
          case .failed(let error) where error != .notFound:
            ContentUnavailableView {
              Label {
                Text(
                  "Couldn't load this subject", tableName: "Plan",
                  comment: "Title shown when a subject failed to load")
              } icon: {
                Image(systemName: "wifi.exclamationmark")
              }
            } actions: {
              Button {
                Task { await syllabus.refresh() }
              } label: {
                Text("Try again", tableName: "Plan", comment: "Retries loading the plan")
              }
              .buttonStyle(.bordered)
            }
          default:
            ContentUnavailableView {
              Label {
                Text(
                  "This subject isn't in your plan", tableName: "Plan",
                  comment: "Shown for a subject the learner's plan doesn't have")
              } icon: {
                Image(systemName: "books.vertical")
              }
            }
          }
        }
      }
      .navigationTitle(subject.map { Text($0.name) } ?? Text(verbatim: ""))
      .toolbarTitleDisplayMode(.inline)
      // The page heads itself with its title, as main does; the bar keeps it for the back button.
      .toolbar(removing: .title)
      .toolbar {
        ToolbarItem(placement: .primaryAction) {
          TutorAskButton(scope: .subject(goalId: goal.id, subjectKey: subjectKey))
        }

        ToolbarItem(placement: .primaryAction) {
          Menu {
            Button {
              isReporting = true
            } label: {
              Label {
                Text(
                  "Report a problem", tableName: "Plan",
                  comment: "Opens the feedback form about the subject page")
              } icon: {
                Image(systemName: "flag")
              }
            }
          } label: {
            Label {
              Text(
                "Subject options", tableName: "Plan",
                comment: "Spoken label of the subject's … menu")
            } icon: {
              Image(systemName: "ellipsis")
            }
          }
        }
      }
      .sheet(isPresented: $isReporting) {
        FeedbackSheet(api: FeedbackAPI.live(), context: FeedbackContext(screen: "subject"))
      }
      .loads(syllabus)
    }
  }
}

private struct SubjectContent: View {
  @Environment(AppRouter.self) private var router

  let goal: LearnerGoal
  let subject: SyllabusSubject

  var body: some View {
    PaneSplit(primaryShare: 0.55) {
      List {
        header
        chaptersSection
      }
    } secondary: {
      List {
        numbers
        topics
      }
    } single: {
      List {
        header
        numbers
        topics
        chaptersSection
      }
    }
  }

  private var isExam: Bool { goal.kind == .exam }

  /// Main's subject facts: its topics and chapters, and how much is done while it's taught in
  /// lessons.
  private var facts: [String] {
    [
      subject.topics.isEmpty
        ? nil
        : String(
          localized: "\(subject.topics.count) topics", table: "Plan",
          comment: "How many topics a subject has"),
      subject.chapters.isEmpty
        ? nil
        : String(
          localized: "\(subject.chapters.count) chapters", table: "Plan",
          comment: "How many chapters a subject has"),
      subject.notPlannedReason == nil && subject.preparation == nil
        ? String(
          localized:
            "\(subject.lessonShare.formatted(.percent.precision(.fractionLength(0)))) done",
          table: "Plan", comment: "How much of a subject is done, as in 40% done")
        : nil,
    ].compactMap(\.self)
  }

  private var header: some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        Group {
          if isExam {
            Text("Subject", tableName: "Plan", comment: "Eyebrow of an exam subject's page")
          } else {
            Text("Module", tableName: "Plan", comment: "Eyebrow of a plan module's page")
          }
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)

        Text(subject.name)
          .font(.title2.weight(.semibold))

        if !facts.isEmpty {
          Text(verbatim: facts.joined(separator: " · "))
            .font(.subheadline)
            .monospacedDigit()
            .foregroundStyle(.secondary)
        }

        if let reason = subject.notPlannedReason, !reason.isEmpty {
          Text("Not in your plan", tableName: "Plan", comment: "A subject the plan leaves out")
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        if subject.notPlannedReason == nil,
          let chapterId = subject.chapters.first(where: {
            $0.state != .done && $0.chapterId != nil
          })?.chapterId
        {
          Button {
            router.open(chapterRoute(chapterId))
          } label: {
            Group {
              if subject.lessonsDone > 0 {
                Text("Continue", tableName: "Plan", comment: "Opens the subject's next chapter")
              } else {
                Text("Start", tableName: "Plan", comment: "Opens the subject's first chapter")
              }
            }
            .frame(maxWidth: .infinity)
          }
          .buttonStyle(.mainAction)
          .controlSize(.large)
          .padding(.top, 4)
        }
      }
      .padding(.vertical, 4)
    }
  }

  private var numbers: some View {
    Section {
      if isExam, let preparation = subject.preparation {
        meter(
          label: Text(
            "Preparation", tableName: "Plan", comment: "Label of a subject's preparation"),
          share: preparation)
      }

      meter(
        label: Text(
          "Lessons studied", tableName: "Plan", comment: "Label of a subject's lessons studied"),
        share: subject.lessonShare)

      if subject.lessonsKnown > 0 {
        LabeledContent {
          Text(subject.lessonsKnown, format: .number).monospacedDigit()
        } label: {
          Text("Known", tableName: "Plan", comment: "Lessons the learner already knew")
        }
      }

      if isExam, subject.preparation != nil {
        LabeledContent {
          if let mastery = subject.mastery {
            Text(
              "\(mastery.correct) of \(mastery.answered) right", tableName: "Plan",
              comment: "A subject's first answers to unseen questions that were right")
          } else {
            Text(
              "Shows after a few practice questions", tableName: "Plan",
              comment: "Mastery isn't counted yet")
          }
        } label: {
          Text("Mastery", tableName: "Plan", comment: "Label of a subject's mastery")
        }
      }
    }
  }

  @ViewBuilder
  private var topics: some View {
    if !subject.topics.isEmpty {
      SubjectTopicsSection(goal: goal, subject: subject)
    }
  }

  @ViewBuilder
  private var chaptersSection: some View {
    let chapters = subject.chapters
    let done = chapters.filter { $0.state == .done || $0.known }.count

    if !chapters.isEmpty {
      Section {
        ForEach(chapters) { chapter in
          SubjectChapterRow(goal: goal, chapter: chapter)
        }
      } header: {
        HStack {
          Text("Chapters", tableName: "Plan", comment: "Section of a subject's chapters")
          Spacer()
          Text(
            "\(done) of \(chapters.count)", tableName: "Plan",
            comment: "Chapters done of the subject's chapters"
          )
          .monospacedDigit()
        }
      }
    }
  }

  private func meter(label: Text, share: Double) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      LabeledContent {
        Text(share, format: .percent.precision(.fractionLength(0)))
          .monospacedDigit()
      } label: {
        label
      }

      ProgressView(value: share)
        .tint(.success)
        .accessibilityHidden(true)
    }
    .accessibilityElement(children: .combine)
  }

  private func chapterRoute(_ chapterId: String) -> AppRoute {
    goal.kind == .language ? .languageUnit(chapterId: chapterId) : .chapter(chapterId: chapterId)
  }
}

private struct SubjectChapterRow: View {
  let goal: LearnerGoal
  let chapter: SyllabusSubject.Chapter

  var body: some View {
    if let chapterId = chapter.chapterId {
      NavigationLink(
        value: goal.kind == .language
          ? AppRoute.languageUnit(chapterId: chapterId) : AppRoute.chapter(chapterId: chapterId)
      ) {
        content
      }
    } else {
      content
        .foregroundStyle(.secondary)
    }
  }

  /// Main's syllabus chapter row: numbered, what's left of the one in progress, and when the plan
  /// studies it next.
  private var content: some View {
    PlanPathRow {
      Label {
        VStack(alignment: .leading, spacing: 2) {
          Text(verbatim: "\(chapter.position). \(chapter.title)")
            .foregroundStyle(chapter.state == .done ? .secondary : .primary)

          if let line {
            line
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
      } icon: {
        StatusMark(status: status)
      }
    } value: {
      if chapter.state != .done, let nextDate = chapter.nextDate {
        Text(PlanDate.text(nextDate, today: isoDay(.now)))
          .monospacedDigit()
      }
    }
  }

  private var line: Text? {
    if chapter.known {
      return Text(
        "Skipped because you already know it", tableName: "Plan",
        comment: "A chapter the learner tested out of")
    }

    if chapter.writing && chapter.chapterId == nil {
      return Text(
        "Being written", tableName: "Plan",
        comment: "A chapter whose lessons are still being written")
    }

    guard chapter.state == .current else {
      return nil
    }

    return Text(
      "\(chapter.lessonsTotal) lessons · \(chapter.lessonsDone) done", tableName: "Plan",
      comment: "The chapter in progress: its lessons and how many are done")
  }

  private var status: StatusMark.Status {
    if chapter.known {
      return .skipped
    }

    switch chapter.state {
    case .done: return .done
    case .current: return .next
    case .upcoming: return .todo
    }
  }
}

private struct SubjectTopicsSection: View {
  let goal: LearnerGoal
  let subject: SyllabusSubject

  var body: some View {
    let headings = subject.topics.reduce(into: [String?]()) { headings, topic in
      if headings.last != .some(topic.heading) {
        headings.append(topic.heading)
      }
    }

    ForEach(Array(headings.enumerated()), id: \.offset) { index, heading in
      Section {
        ForEach(subject.topics.filter { $0.heading == heading }) { topic in
          SubjectTopicRow(goal: goal, topic: topic)
        }
      } header: {
        if index == 0 {
          HStack(alignment: .firstTextBaseline) {
            Text("Topics", tableName: "Plan", comment: "Section of a subject's topics")

            if let studied = subject.topicsStudied {
              Spacer()
              Text(
                "\(studied) of \(subject.topics.count) topics", tableName: "Plan",
                comment: "Topics studied of the subject's topics"
              )
              .monospacedDigit()
            }
          }
        } else if let heading {
          Text(heading)
        }
      }
    }
  }
}

private struct SubjectTopicRow: View {
  let goal: LearnerGoal
  let topic: SyllabusSubject.Topic

  var body: some View {
    if topic.chapters.isEmpty {
      label
    } else {
      DisclosureGroup {
        ForEach(topic.chapters) { chapter in
          if let chapterId = chapter.chapterId {
            NavigationLink(
              value: goal.kind == .language
                ? AppRoute.languageUnit(chapterId: chapterId)
                : AppRoute.chapter(chapterId: chapterId)
            ) {
              Text(chapter.title)
            }
          } else {
            Text(chapter.title)
              .foregroundStyle(.secondary)
          }
        }
      } label: {
        label
      }
    }
  }

  private var label: some View {
    Label {
      VStack(alignment: .leading, spacing: 2) {
        HStack {
          Text(topic.name)
            .foregroundStyle(topic.notPlannedReason == nil ? .primary : .secondary)

          if topic.frequency == "high" {
            Text("Appears a lot", tableName: "Plan", comment: "A topic past exams ask often")
              .chip()
          }
        }

        if topic.notPlannedReason != nil {
          Text("Not in your plan", tableName: "Plan", comment: "A subject the plan leaves out")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }
    } icon: {
      StatusMark(status: status)
    }
  }

  private var status: StatusMark.Status {
    switch topic.status {
    case "studied": .done
    case "known": .skipped
    case "inProgress": .next
    default: .todo
    }
  }
}
