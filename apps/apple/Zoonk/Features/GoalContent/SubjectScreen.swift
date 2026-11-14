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
        if let view = syllabus.value, let subject {
          SubjectContent(goal: goal, syllabus: view, subject: subject)
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
              .buttonStyle(.outline)
            }
            .lonePage()
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
            .lonePage()
          }
        }
      }
      .barTitleAfterHero(subject?.name ?? String(localized: AppTab.plan.title))
      .toolbar {
        TutorAskToolbarItem(scope: .subject(goalId: goal.id, subjectKey: subjectKey))

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
      .feedbackSheet(
        isPresented: $isReporting, context: FeedbackContext(screen: "subject"), isReport: true
      )
      .loads(syllabus)
    }
  }
}

private struct SubjectContent: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  // Above the panes, so a fold or a resize that rebuilds them keeps what the learner opened.
  @State private var showsAllChapters = false
  @State private var showsDoneChapters = false
  @State private var openTopics: Set<SyllabusSubject.Topic.ID> = []

  let goal: LearnerGoal
  let syllabus: GoalSyllabus
  let subject: SyllabusSubject

  var body: some View {
    PaneSplit(primaryShare: 0.55) {
      ZoonkList {
        header
        chaptersSection
      }
    } secondary: {
      ZoonkList {
        numbers
        topics
      }
    } single: {
      ZoonkList {
        header
        numbers
        chaptersSection
        topics
      }
    }
    .bottomBar {
      if let chapterId = nextChapterId {
        Button {
          router.open(chapterRoute(chapterId))
        } label: {
          if subject.lessonsDone > 0 {
            Text("Continue", tableName: "Plan", comment: "Opens the subject's next chapter")
          } else {
            Text("Start", tableName: "Plan", comment: "Opens the subject's first chapter")
          }
        }
        .buttonStyle(.mainAction)
        .keyboardShortcut(.defaultAction)
      }
    }
  }

  private var nextChapterId: String? {
    guard subject.notPlannedReason == nil else {
      return nil
    }

    return subject.chapters.first { $0.state != .done && $0.chapterId != nil }?.chapterId
  }

  private var isExam: Bool { goal.kind == .exam }

  private var sharedExams: [GoalSyllabus.SharedExam] { syllabus.sharedExams(of: subject) }

  /// Main's subject facts: its questions on the exam, its topics and chapters, and how much is done
  /// while it's taught in lessons.
  private var facts: [String] {
    [
      subject.questions.flatMap { questions in
        questions > 0
          ? String(
            localized: "\(questions) questions", table: "Plan",
            comment: "How many of the exam's questions a subject has")
          : nil
      },
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
      PageHeader(
        Text(subject.name),
        supporting: facts.isEmpty ? nil : Text(verbatim: facts.joinedFacts()).monospacedDigit())

      if !sharedExams.isEmpty {
        AlsoInExams(exams: sharedExams)
          .listRowSeparator(.hidden)
      }

      if let reason = subject.notPlannedReason, !reason.isEmpty {
        SubjectNotPlannedNotice(goalId: goal.id, reason: reason, areas: subject.areas)
          .listRowSeparator(.hidden)
      }
    }
  }

  /// Main's `SubjectCoverage`: the preparation an exam measures, or else the lessons studied.
  @ViewBuilder
  private var numbers: some View {
    if let preparation = subject.preparation {
      Section {
        SubjectPreparation(share: preparation, mastery: subject.mastery)
      }
    } else if subject.notPlannedReason == nil {
      Section {
        meter(
          label: Text(
            "Lessons studied", tableName: "Plan", comment: "Label of a subject's lessons studied"),
          share: subject.lessonShare)

        if subject.lessonsKnown > 0 {
          LabeledContent {
            Text(
              "\(subject.lessonsKnown) lessons skipped", tableName: "Plan",
              comment: "Lessons of a subject the learner skipped because they already knew them"
            )
            .monospacedDigit()
          } label: {
            Text(
              "Skipped", tableName: "Plan",
              comment: "Label of a subject's lessons the learner already knew")
          }
        }
      }
    }
  }

  @ViewBuilder
  private var topics: some View {
    if !subject.topics.isEmpty {
      SubjectTopicsSection(goal: goal, syllabus: syllabus, subject: subject, open: $openTopics)
    }
  }

  /// Main's `SubjectChapters`: the chapters done under one line, then the next few.
  @ViewBuilder
  private var chaptersSection: some View {
    let chapters = subject.chapters
    let done = chapters.filter { $0.state == .done }
    let ahead = chapters.filter { $0.state != .done }
    let shown = showsAllChapters ? ahead : Array(ahead.prefix(5))
    let hidden = ahead.count - shown.count

    if !chapters.isEmpty {
      Section {
        if !done.isEmpty {
          SubjectDoneChapters(goal: goal, chapters: done, isExpanded: $showsDoneChapters)
        }

        ForEach(shown) { chapter in
          SubjectChapterRow(goal: goal, chapter: chapter)
        }

        if hidden > 0 {
          Button {
            showsAllChapters = true
          } label: {
            ListRow(
              Text(
                "\(hidden) more chapters", tableName: "Plan",
                comment: "Shows the phase's chapters left out around the next one"
              )
              .foregroundStyle(.mutedForeground)
            ) {
              Image(systemName: "plus")
            }
          }
        }
      } header: {
        SectionTitle(
          Text("Chapters", tableName: "Plan", comment: "Section of a subject's chapters")
        ) {
          HStack(spacing: 12) {
            Text(
              "\(done.count { !$0.known }) of \(chapters.count)", tableName: "Plan",
              comment: "Chapters done of the subject's chapters"
            )
            .monospacedDigit()

            if learner.summary.value?.places.mindMaps == true {
              Button {
                router.open(.mindMaps(subjectKey: subject.key))
              } label: {
                Label {
                  Text("Mind maps", tableName: "Plan", comment: "Opens the subject's mind maps")
                } icon: {
                  KindMark(kind: .mindMap)
                }
              }
              .buttonStyle(.ghost)
              .controlSize(.small)
            }
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

      Meter(value: share, fill: .success)
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
        .chevronSlot()
    }
  }

  /// Main's syllabus chapter row: numbered, what's left of the one in progress, and when the plan
  /// studies it next.
  private var content: some View {
    ListRow(
      Text(chapter.title)
        .foregroundStyle(
          chapter.state == .done || chapter.chapterId == nil
            ? .mutedForeground : Color(.foreground)),
      number: chapter.position, description: line
    ) {
      StatusMark(status: status)
    } trailing: {
      if chapter.state != .done, let nextDate = chapter.nextDate {
        Text(PlanDate.text(nextDate, today: isoDay(.now)))
      }
    }
    .currentRow(chapter.state == .current)
  }

  private var line: Text? {
    if chapter.known {
      return Text(
        "Skipped\u{00A0}· you already know it", tableName: "Plan",
        comment: "A chapter the learner tested out of")
    }

    if chapter.writing && chapter.chapterId == nil {
      return Text("Not ready yet", tableName: "Plan", comment: "A topic whose lessons aren't ready")
    }

    guard chapter.state == .current else {
      return nil
    }

    return Text(
      "\(chapter.lessonsTotal) lessons\u{00A0}· \(chapter.lessonsDone) done", tableName: "Plan",
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

/// Main's `SubjectPreparation`: the share in big type over its bar, and the mastery under them.
private struct SubjectPreparation: View {
  let share: Double
  let mastery: SyllabusSubject.Mastery?

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Preparation", tableName: "Plan", comment: "Label of a subject's preparation")
        .typeStyle(.sectionTitle)

      BigQuantity(share.formatted(.percent.precision(.fractionLength(0))))

      Meter(value: share, fill: .success)

      if let mastery {
        VStack(alignment: .leading, spacing: 2) {
          Text("Right answers", tableName: "Plan", comment: "Label of a subject's right answers")
            .typeWeight(.medium)

          Text(
            "\(mastery.correct) of \(mastery.answered)", tableName: "Plan",
            comment: "A subject's first answers to unseen questions that were right, of all of them"
          )
          .foregroundStyle(.mutedForeground)
        }
        .typeStyle(.meta)
      }
    }
    .padding(.vertical, 4)
    .accessibilityElement(children: .combine)
  }
}

/// Main's `DoneChapters`: the chapters done fold under one line that counts them.
private struct SubjectDoneChapters: View {
  let goal: LearnerGoal
  let chapters: [SyllabusSubject.Chapter]
  @Binding var isExpanded: Bool

  var body: some View {
    DisclosureGroup(isExpanded: $isExpanded) {
      ForEach(chapters) { chapter in
        SubjectChapterRow(goal: goal, chapter: chapter)
      }
    } label: {
      ListRow(line.foregroundStyle(.mutedForeground)) {
        StatusMark(status: chapters.allSatisfy(\.known) ? .skipped : .done)
      }
    }
  }

  private var line: Text {
    let known = chapters.count { $0.known }
    let done = chapters.count - known
    let doneText = Text(
      "\(done) chapters done", tableName: "Plan",
      comment: "A subject's chapters done, on the line they fold under")

    if known == 0 {
      return doneText
    }

    if done == 0 {
      return Text(
        "\(known) chapters skipped because you already know them", tableName: "Plan",
        comment: "A subject's chapters the learner tested out of, on the line they fold under")
    }

    let skipped = Text(
      "\(known) skipped because you already know them", tableName: "Plan",
      comment: "After the chapters done: how many the learner tested out of")

    return Text(
      "\(doneText), \(skipped)", tableName: "Plan",
      comment: "The chapters done, then the ones skipped, on the line they fold under")
  }
}

private struct SubjectTopicsSection: View {
  let goal: LearnerGoal
  let syllabus: GoalSyllabus
  let subject: SyllabusSubject
  @Binding var open: Set<SyllabusSubject.Topic.ID>

  var body: some View {
    let headings = subject.topics.reduce(into: [String?]()) { headings, topic in
      if headings.last != .some(topic.heading) {
        headings.append(topic.heading)
      }
    }

    ForEach(Array(headings.enumerated()), id: \.offset) { index, heading in
      Section {
        ForEach(subject.topics.filter { $0.heading == heading }) { topic in
          SubjectTopicRow(
            goal: goal, topic: topic,
            isExpanded: Binding {
              open.contains(topic.id)
            } set: { isOpen in
              if isOpen { open.insert(topic.id) } else { open.remove(topic.id) }
            })
        }
      } header: {
        if index == 0 {
          SectionTitle(title) {
            if let studied = subject.topicsStudied {
              Text(
                "\(studied) of \(subject.topics.count) topics", tableName: "Plan",
                comment: "Topics studied of the subject's topics"
              )
              .monospacedDigit()
            } else {
              Text(
                "\(subject.topics.count) topics", tableName: "Plan",
                comment: "How many topics a subject has"
              )
              .monospacedDigit()
            }
          }
        } else if let heading {
          SectionTitle(Text(heading))
        }
      }
    }
  }

  private var title: Text {
    if syllabus.fromMaterial {
      return Text(
        "Topics in your material", tableName: "Plan",
        comment: "Section of a subject's topics, from the learner's own material")
    }

    return Text(
      "Topics on the exam", tableName: "Plan",
      comment: "Section of a subject's topics, from the exam's official notice or guide")
  }
}

private struct SubjectTopicRow: View {
  let goal: LearnerGoal
  let topic: SyllabusSubject.Topic
  @Binding var isExpanded: Bool

  var body: some View {
    if topic.chapters.isEmpty {
      label
    } else {
      DisclosureGroup(isExpanded: $isExpanded) {
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
              .foregroundStyle(.mutedForeground)
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
            .foregroundStyle(topic.notPlannedReason == nil ? Color(.foreground) : .mutedForeground)

          if topic.frequency == "high" {
            Text("Asked a lot", tableName: "Plan", comment: "A topic past exams asked often")
              .chip()
          }
        }

        if let note {
          note
            .typeStyle(.meta)
            .foregroundStyle(.mutedForeground)
        }
      }
    } icon: {
      StatusMark(status: status)
    }
  }

  private var note: Text? {
    switch topic.notPlannedReason {
    case "time"?:
      return Text(
        "Not in your plan\u{00A0}· your time doesn't cover it", tableName: "Plan",
        comment: "A topic the plan leaves out: no time for it by the date")
    case "skipped"?:
      return Text(
        "Not in your plan\u{00A0}· you took this subject out", tableName: "Plan",
        comment: "A topic the plan leaves out: the learner took its subject out")
    case "missing"?:
      return Text("Not ready yet", tableName: "Plan", comment: "A topic whose lessons aren't ready")
    case .some:
      return Text("Not in your plan", tableName: "Plan", comment: "A subject the plan leaves out")
    case nil:
      return topic.status == "known"
        ? Text(
          "Skipped\u{00A0}· you already know it", tableName: "Plan",
          comment: "A chapter the learner tested out of")
        : nil
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

/// Says why the subject isn't in the plan, with the way back main offers for each reason.
private struct SubjectNotPlannedNotice: View {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var plans
  @State private var failed = false
  @State private var isRestoring = false

  let goalId: String
  let reason: String
  let areas: [String]

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Label {
        switch reason {
        case "skipped":
          Text(
            "You took this subject out of your plan.", tableName: "Plan",
            comment: "Why a subject isn't in the plan: the learner skipped it")
        case "time":
          Text(
            "This subject isn't in your plan: not enough time before your exam.",
            tableName: "Plan",
            comment: "Why a subject isn't in the plan: no time for it by the date")
        case "missing":
          Text(
            "This subject isn't in your plan yet.", tableName: "Plan",
            comment: "Why a subject isn't in the plan: no lesson teaches it yet")
        default:
          Text("Not in your plan", tableName: "Plan", comment: "A subject the plan leaves out")
        }
      } icon: {
        Image(systemName: "minus.circle")
      }
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)

      if reason == "skipped" {
        BusyButton(isBusy: isRestoring, icon: .addLessons) {
          Task { await restore() }
        } label: {
          Text(
            "Add it back", tableName: "Plan", comment: "Puts a skipped subject back in the plan")
        }
        .buttonStyle(.outline)
      } else if reason == "time" {
        Button {
          router.showRoot(of: .plan)
        } label: {
          Text(
            "Adjust plan", tableName: "Plan", comment: "Opens the plan's settings to change them")
        }
        .buttonStyle(.outline)
      }

      if failed {
        FailureLine(
          message: LocalizedStringResource(
            "That didn't work. Try again in a moment.", table: "Plan",
            comment: "Says the subject didn't come back into the plan")
        )
        .typeStyle(.body)
      }
    }
  }

  private func restore() async {
    isRestoring = true
    defer { isRestoring = false }

    switch await plans.change(goalId: goalId, edits: [.restoreAreas(areas)]) {
    case .done(.invalid), .failed: failed = true
    case .done: failed = false
    case .obsolete: break
    }
  }
}
