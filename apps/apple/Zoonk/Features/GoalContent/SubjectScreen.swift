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
            PageLoadFailure {
              Label {
                if goal.kind == .exam {
                  Text(
                    "Couldn't load this subject", tableName: "Plan",
                    comment: "Title shown when a subject failed to load")
                } else {
                  Text(
                    "Couldn't load this module", tableName: "Plan",
                    comment:
                      "Title shown when a module failed to load. A module is a part of a plan that isn't for an exam."
                  )
                }
              } icon: {
                Image(systemName: "wifi.exclamationmark")
              }
            } retry: {
              await syllabus.refresh()
            }
          default:
            StateMessage {
              Label {
                if goal.kind == .exam {
                  Text(
                    "This subject isn't in your plan", tableName: "Plan",
                    comment: "Shown for a subject the learner's plan doesn't have")
                } else {
                  Text(
                    "This module isn't in your plan", tableName: "Plan",
                    comment:
                      "Shown for a module the learner's plan doesn't have. A module is a part of a plan that isn't for an exam."
                  )
                }
              } icon: {
                Image(systemName: "books.vertical")
              }
            }
            .lonePage()
          }
        }
      }
      .barTitleAfterHero(subject?.shortName ?? String(localized: AppTab.plan.title))
      .toolbar {
        TutorAskToolbarItem(
          scope: .subject(goalId: goal.id, subjectKey: subjectKey, module: goal.kind != .exam))

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
              if goal.kind == .exam {
                Text(
                  "Subject options", tableName: "Plan",
                  comment: "Spoken label of the subject's … menu")
              } else {
                Text(
                  "Module options", tableName: "Plan",
                  comment:
                    "Spoken label of the module's … menu. A module is a part of a plan that isn't for an exam."
                )
              }
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
  @State private var restoring = VisitRequest<Bool>()
  @State private var writeFailed = false

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
      // As on the web, only the side pane names the questions and the next date.
      ZoonkList {
        numbers(titled: true)
        SubjectDetails(subject: subject, edition: syllabus.questionsSource?.edition)
        topics
      }
    } single: {
      ZoonkList {
        header
        numbers(titled: false)
        chaptersSection
        topics
      }
    }
    .bottomBar(note: writeNote) {
      // A written part's main action is writing: its lessons are a small part of its time.
      // An unfinished task opens where it was left; once the day's grading is used the bar says
      // when it returns instead of offering a tap that would be refused.
      // Every task waiting for an exam choice leaves nothing to write until it's made, on Today.
      if let written, written.pendingChoice?.all == true {
        Button {
          router.showRoot(of: .today)
        } label: {
          Text("Choose on Today", tableName: "Plan")
        }
        .buttonStyle(.mainAction)
        .keyboardShortcut(.defaultAction)
      } else if let written, let returnsOn = written.returnsOn {
        Label {
          Text(WritingLabels.gradingReturns(returnsOn))
        } icon: {
          Image(systemName: "clock")
        }
        .typeStyle(.body)
        .foregroundStyle(.mutedForeground)
        .frame(maxWidth: .infinity, minHeight: 44)
      } else if let written {
        WriteNowButton(
          goalId: goal.id, taskKey: written.unfinished?.taskKey,
          continues: written.unfinished != nil, failed: $writeFailed
        )
        .keyboardShortcut(.defaultAction)
      } else if let chapterId = nextChapterId {
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
    .onDisappear {
      restoring.leave()
    }
  }

  private var written: GoalPlan.WrittenPractice.Subject? {
    syllabus.writtenPractice?.subject(for: subject)
  }

  private var writeNote: BarNote? {
    if writeFailed {
      return BarNote(
        LocalizedStringResource(
          "That didn't go through. Try again in a moment.", table: "Plan"))
    }

    guard let choice = written?.pendingChoice else { return nil }

    if choice.all {
      return BarNote(WritingLabels.choiceLine(choice.groups), tone: .status)
    }

    return BarNote(
      WritingLabels.choiceLine(choice.groups, task: choice.task), tone: .status,
      action: .init(
        label: Text("Choose on Today", tableName: "Plan"),
        perform: { router.showRoot(of: .today) }))
  }

  private var nextChapterId: String? {
    guard subject.notPlannedReason == nil else {
      return nil
    }

    return subject.chapters.first { $0.state != .done && $0.chapterId != nil }?.chapterId
  }

  private var isExam: Bool { goal.kind == .exam }

  private var sharedExams: [GoalSyllabus.SharedExam] { syllabus.sharedExams(of: subject) }

  /// Main's `SubjectFacts`: where the subject comes from when its name doesn't say, its weight when
  /// the exam gives no question count, and how much is done while lessons teach it. Topics and
  /// chapters count themselves over their lists.
  private var facts: [String] {
    if let written {
      return writtenFacts(written)
    }

    let inLessons = subject.notPlannedReason == nil && subject.preparation == nil
    return [origin, examShare, inLessons ? doneShare : nil].compactMap(\.self)
  }

  /// A written part says how many questions, its official time and its share of the score.
  private func writtenFacts(_ written: GoalPlan.WrittenPractice.Subject) -> [String] {
    [
      written.questions.map {
        String(localized: "\($0) questions", table: "Plan", comment: "A written part's questions")
      },
      written.minutes.map { studyDuration(minutes: $0) },
      written.share.map {
        String(
          localized: "\(WritingLabels.share($0)) of the score",
          table: "Plan")
      },
    ].compactMap(\.self)
  }

  private var origin: String? {
    if subject.isExtra {
      return syllabus.extraLabel
    }

    if let group = subject.group {
      return group
    }

    return subject.source == "notice" && syllabus.fromMaterial
      ? String(localized: "From your material", table: "Plan") : nil
  }

  private var examShare: String? {
    guard (subject.questions ?? 0) == 0, let share = subject.share else {
      return nil
    }

    return String(
      localized:
        "\(share.formatted(.percent.precision(.fractionLength(0)).locale(.appLanguage))) of the exam",
      table: "Exam", comment: "A subject's weight")
  }

  /// Nothing until some is done, since "0% done" says nothing.
  private var doneShare: String? {
    let percent = Int((min(max(subject.lessonShare, 0), 1) * 100).rounded())
    return percent > 0
      ? String(localized: "\(percent)% done", table: "Plan", locale: .appLanguage) : nil
  }

  private var knownLine: Text? {
    if let topicsKnown = subject.topicsKnown, !subject.topics.isEmpty {
      return topicsKnown > 0
        ? Text(
          "\(topicsKnown) topics you already know", tableName: "Plan",
          comment: "A row of topics placement showed the learner knows")
        : nil
    }

    return subject.lessonsKnown > 0
      ? Text("\(subject.lessonsKnown) lessons you already know", tableName: "Plan") : nil
  }

  private var header: some View {
    Section {
      PageHeader(
        Text(subject.shortName),
        facts: facts)

      if let knownLine {
        knownLine
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
          .listRowSeparator(.hidden)
      }

      if !sharedExams.isEmpty {
        AlsoInExams(exams: sharedExams)
          .listRowSeparator(.hidden)
      }

      if let reason = subject.notPlannedReason, !reason.isEmpty {
        SubjectNotPlannedNotice(
          goalId: goal.id, reason: reason, areas: subject.areas, module: goal.kind != .exam,
          restoring: restoring
        )
        .listRowSeparator(.hidden)
      }
    }
  }

  /// Main's `SubjectCoverage`: the preparation an exam measures, or else its progress, titled
  /// beside the page as main's aside titles it.
  @ViewBuilder
  private func numbers(titled: Bool) -> some View {
    if let written {
      SubjectWrittenSections(written: written)
    } else if let preparation = subject.preparation {
      Section {
        SubjectPreparation(share: preparation, mastery: subject.mastery)
      }
    } else if subject.notPlannedReason == nil {
      Section {
        SubjectProgress(coverage: subject.coverage, titled: titled)
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
    let done = chapters.doneChapters
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
          MoreRowsFold(
            words: Text(
              "\(hidden) more chapters", tableName: "Plan",
              comment: "Shows the phase's chapters left out around the next one"),
            isUnfolded: $showsAllChapters)
        }
      } header: {
        SectionTitle(
          Text("Chapters", tableName: "Plan", comment: "Section of a subject's chapters"),
          alignment: .center
        ) {
          Text(
            "\(done.count) of \(chapters.count) chapters", tableName: "Plan",
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
                // Main's quiet lucide Network, as on Android: the header's action, not a kind's mark.
                Image(systemName: LearnKind.mindMap.systemImage)
              }
            }
            .buttonStyle(.ghost.endsRow)
            .controlSize(.small)
            .fixedSize(horizontal: true, vertical: false)
          }
        }
      }
    }
  }

  private func chapterRoute(_ chapterId: String) -> AppRoute {
    goal.kind == .language ? .languageUnit(chapterId: chapterId) : .chapter(chapterId: chapterId)
  }
}

private struct SubjectChapterRow: View {
  let goal: LearnerGoal
  let chapter: SyllabusSubject.Chapter

  var body: some View {
    Group {
      if let chapterId = chapter.chapterId {
        NavigationLink(
          value: goal.kind == .language
            ? AppRoute.languageUnit(chapterId: chapterId) : AppRoute.chapter(chapterId: chapterId)
        ) {
          content
            .disclosureChevron()
        }
        .navigationLinkIndicatorVisibility(.hidden)
      } else {
        content
      }
    }
    .currentRow(chapter.state == .current)
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
        Text(PlanDate.text(nextDate, today: PlanDate.today()))
      }
    }
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
/// The lessons studied, the ones the learner already knew and the new ones, on one bar.
private struct SubjectProgress: View {
  let coverage: CoverageLegend.Shares
  let titled: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      if titled {
        Text("Progress", tableName: "Plan", comment: "Label of the goal's progress number")
          .typeStyle(.sectionTitle)
      }

      CoverageBar(studied: coverage.studied, known: coverage.known)

      CoverageLegend(shares: coverage)
    }
    .padding(.vertical, 4)
  }
}

private struct SubjectPreparation: View {
  let share: Double
  let mastery: SyllabusSubject.Mastery?

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Preparation", tableName: "Plan", comment: "Label of a subject's preparation")
        .typeStyle(.sectionTitle)

      BigQuantity(share.formatted(.percent.precision(.fractionLength(0)).locale(.appLanguage)))

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

/// Main's `SubjectDetails`: the subject's questions on the exam, when the plan studies it next and
/// the lessons it skips.
private struct SubjectDetails: View {
  let subject: SyllabusSubject
  let edition: String?

  var body: some View {
    let questions = subject.questions ?? 0
    let nextDate = subject.nextDate

    if questions > 0 || nextDate != nil || subject.lessonsKnown > 0 {
      Section {
        if questions > 0 {
          row(questionsLabel) {
            Text(questions, format: .number)
              .typeStyle(.data)
          }
        }

        if let nextDate {
          row(Text("Next date", tableName: "Plan")) {
            Text(PlanDate.text(nextDate, today: PlanDate.today()))
              .typeStyle(.data)
          }
        }

        if subject.lessonsKnown > 0 {
          row(
            Text(
              "Skipped", tableName: "Plan",
              comment: "Label of a subject's lessons the learner already knew")
          ) {
            Text(
              "\(subject.lessonsKnown) lessons", tableName: "Plan",
              comment: "How many lessons a chapter has")
          }
        }
      } header: {
        SectionTitle(Text("Details", tableName: "Plan"))
      }
    }
  }

  private var questionsLabel: Text {
    if let edition {
      return Text(
        "Questions · \(edition)", tableName: "Plan",
        comment:
          "Labels a subject's count of questions from a past exam. The exam's name and year go last, after the separator, with no article before them."
      )
    }

    return Text(
      "Questions", tableName: "Plan",
      comment: "Labels the number of questions in an exam or a mock exam.")
  }

  private func row(_ label: Text, @ViewBuilder value: () -> some View) -> some View {
    LabeledContent {
      value()
        .foregroundStyle(Color(.foreground))
    } label: {
      label
        .foregroundStyle(.mutedForeground)
    }
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
          SectionLabel(Text(heading))
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

struct SubjectTopicRow: View {
  let goal: LearnerGoal
  let topic: SyllabusSubject.Topic
  @Binding var isExpanded: Bool
  /// A new plan's subjects only say what's there: none of a topic's chapters opens.
  var opens = true

  var body: some View {
    if topic.chapters.isEmpty {
      label
    } else {
      DisclosureGroup(isExpanded: $isExpanded) {
        ForEach(topic.chapters) { chapter in
          if opens, let chapterId = chapter.chapterId {
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
    let reason = topic.status == "known" ? "known" : topic.notPlannedReason
    return reason.map { planOutsideReason($0, module: goal.kind != .exam) }
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

/// Main's `NotPlannedCallout`: a notice card saying why the subject isn't in the plan, with the way
/// back main offers for each reason.
private struct SubjectNotPlannedNotice: View {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var plans

  let goalId: String
  let reason: String
  let areas: [String]
  /// A goal that isn't an exam lists modules, so the notice says "module" too.
  let module: Bool
  let restoring: VisitRequest<Bool>

  var body: some View {
    Label {
      VStack(alignment: .leading, spacing: 10) {
        switch reason {
        case "skipped":
          if module {
            Text(
              "You took this module out of your plan.", tableName: "Plan",
              comment:
                "Why a module isn't in the plan: the learner skipped it. A module is a part of a plan that isn't for an exam."
            )
          } else {
            Text(
              "You took this subject out of your plan.", tableName: "Plan",
              comment: "Why a subject isn't in the plan: the learner skipped it")
          }

          BusyButton(isBusy: restoring.isRunning, icon: .addLessons) {
            restore()
          } label: {
            Text("Add it back", tableName: "Plan")
          }
          .buttonStyle(.outline)
          .controlSize(.small)
        case "time":
          Button {
            router.showRoot(of: .plan)
          } label: {
            Text(timeLine)
              .foregroundStyle(Color(.foreground))
              .multilineTextAlignment(.leading)
          }
          // Borderless, so in a list row only the sentence answers a tap.
          .buttonStyle(.borderless)
        case "missing" where module:
          Text(
            "This module isn't in your plan yet.", tableName: "Plan",
            comment:
              "Why a module isn't in the plan: no lesson teaches it yet. A module is a part of a plan that isn't for an exam."
          )
        case "missing":
          Text(
            "This subject isn't in your plan yet.", tableName: "Plan",
            comment: "Why a subject isn't in the plan: no lesson teaches it yet")
        default:
          Text("Not in your plan", tableName: "Plan", comment: "A subject the plan leaves out")
        }

        if restoring.outcome == false {
          FailureLine(
            message: LocalizedStringResource(
              "That didn't work. Try again in a moment.", table: "Plan",
              comment: "Says the subject didn't come back into the plan")
          )
        }
      }
      .foregroundStyle(Color(.foreground))
    } icon: {
      Image(systemName: "minus.circle")
        .foregroundStyle(.mutedForeground)
    }
    .typeStyle(.note)
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
    .panel()
  }

  /// The reason, then "Adjust plan" in ink and underlined, as two sentences sit.
  private var timeLine: AttributedString {
    let reason =
      module
      ? String(
        localized: "This module isn't in your plan. Other modules come first.", table: "Plan",
        comment:
          "Why a module isn't in the learner's plan: their study time goes to modules that come first. Followed by a link to change the plan. A module is a part of a plan that isn't for an exam."
      )
      : String(
        localized: "This subject isn't in your plan. Other subjects come first.", table: "Plan",
        comment:
          "Why a subject isn't in the learner's plan: their study time goes to subjects that matter more first. Followed by a link to change the plan."
      )
    var link = AttributedString(
      localized: "Adjust plan", table: "Plan", comment: "Opens the plan's settings to change them")
    link.underlineStyle = .single

    return AttributedString([reason, ""].joinedSentences()) + link
  }

  private func restore() {
    restoring.run { [plans, goalId, areas] in
      switch await plans.change(goalId: goalId, edits: [.restoreAreas(areas)]) {
      case .done(.invalid), .failed: return false
      case .done: return true
      case .obsolete: return nil
      }
    }
  }
}
