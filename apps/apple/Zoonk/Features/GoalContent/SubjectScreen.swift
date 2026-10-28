import SwiftUI

/// A subject (an exam's) or module (another goal's) of the plan, read from the Plan's syllabus:
/// how far the learner is, "Continue" into its next chapter, and its chapters in order with the
/// next one marked. A subject outside the plan says so.
struct SubjectScreen: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(PlanStore.self) private var plans

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
    let isExam = goal.kind == .exam
    let chapters = subject.chapters
    let done = chapters.filter { $0.state == .done || $0.known }.count
    let next = chapters.first { $0.state == .current && $0.chapterId != nil }

    List {
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

          if let reason = subject.notPlannedReason, !reason.isEmpty {
            Text("Not in your plan", tableName: "Plan", comment: "A subject the plan leaves out")
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }

          if let next, let chapterId = next.chapterId {
            Button {
              router.open(chapterRoute(chapterId))
            } label: {
              Text("Continue", tableName: "Plan", comment: "Opens the subject's next chapter")
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.mainAction)
            .controlSize(.large)
            .padding(.top, 4)
          }
        }
        .padding(.vertical, 4)
      }

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

      if !subject.topics.isEmpty {
        SubjectTopicsSection(goal: goal, subject: subject)
      }

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

  private var content: some View {
    LabeledContent {
      if chapter.lessonsTotal > 0 {
        Text(
          "\(chapter.lessonsDone) / \(chapter.lessonsTotal)", tableName: "Plan",
          comment: "Lessons done of a chapter's lessons"
        )
        .monospacedDigit()
      }
    } label: {
      Label {
        VStack(alignment: .leading, spacing: 2) {
          Text(chapter.title)

          if chapter.writing && chapter.chapterId == nil {
            Text(
              "Being written", tableName: "Plan",
              comment: "A chapter whose lessons are still being written"
            )
            .font(.caption)
            .foregroundStyle(.secondary)
          }
        }
      } icon: {
        StatusMark(status: status)
      }
    }
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

/// The notice's topics, as its own outline (grouped by its headings), each with where the learner
/// stands and opening to the chapters that teach it.
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
