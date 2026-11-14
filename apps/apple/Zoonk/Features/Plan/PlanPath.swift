import SwiftUI

struct PlanPathSection: View {
  @Environment(PlanStore.self) private var store

  let context: PlanContext
  var course: GoalPlan.Course?
  var focusTest: PlanFocusTestRow?

  var body: some View {
    Section {
      focusTest

      if context.goal.kind == .language,
        let alphabet = store.languageUnits(goalId: context.goal.id).value?.alphabet
      {
        PlanAlphabetRow(alphabet: alphabet, goalId: context.goal.id)
      }

      PlanPathRows(context: context)

      if let course {
        NavigationLink(value: AppRoute.course(courseId: course.courseId, title: course.title)) {
          PlanPathLink(systemImage: "books.vertical") {
            Text(
              "See the full course", tableName: "Plan",
              comment: "Opens the Library course the plan is built from")
          }
        }
      }
    } header: {
      SectionTitle(
        Text(
          "Your path", tableName: "Plan", comment: "Section of the plan's phases and chapters"))
    }
  }
}

struct PlanPathRows: View {
  let context: PlanContext
  /// The roadmap's list of every phase leaves out what a challenge is, where it would repeat.
  var brief = false

  var body: some View {
    let phases = context.plan.phases
    let open =
      (phases.first { phase in phase.chapters.contains { $0.state == .current } }
      ?? phases.first { $0.state == .current })?.index
    let beforeFinish = phases.filter { $0.kind != .afterExam }
    let last = beforeFinish.last?.index

    ForEach(beforeFinish) { phase in
      PlanPhaseRow(
        context: context, phase: phase, isOpen: phase.index == open, isLast: phase.index == last,
        brief: brief)
    }

    IconLabeledContent {
      planFinishText(context)
    } title: {
      Text(context.goal.displayName)
    } icon: {
      Image(systemName: "flag")
    }
    .chevronSlot()

    ForEach(phases.filter { $0.kind == .afterExam }) { phase in
      PlanPhaseRow(
        context: context, phase: phase, isOpen: phase.index == open, isLast: false, brief: brief)
    }
  }
}

extension PlanPhase {
  var mark: StatusMark.Status {
    switch state {
    case .done: .done
    case .current: .next
    case .leftOut, .unfinished, .upcoming: .todo
    }
  }
}

private struct PlanPhaseRow: View {
  @Environment(PlanStore.self) private var store
  @Environment(\.stacksContent) private var isStacked

  let context: PlanContext
  let phase: PlanPhase
  let isOpen: Bool
  let isLast: Bool
  let brief: Bool

  private var disclosure: PlanStore.PhaseDisclosure {
    store.phaseDisclosure(goalId: context.goal.id, phase: phase.index)
  }

  private var isExpanded: Bool { disclosure.isExpanded ?? isOpen }

  private var expansion: Binding<Bool> {
    Binding {
      isExpanded
    } set: { isExpanded in
      store.setPhaseDisclosure(goalId: context.goal.id, phase: phase.index) {
        $0.isExpanded = isExpanded
      }
    }
  }

  var body: some View {
    if let own = ownChapter, let chapterId = own.chapterId {
      PlanRouteLink(
        route: context.goal.kind == .language
          ? .languageUnit(chapterId: chapterId) : .chapter(chapterId: chapterId)
      ) {
        header(byPlace: false, next: own.state == .current)
      }

      if isOpen {
        events
      }
    } else if phase.chapters.isEmpty && phase.checkpoint == nil {
      header(byPlace: false, next: false)
        .chevronSlot()
    } else {
      DisclosureGroup(isExpanded: expansion) {
        chapterRows
        events
      } label: {
        // Open over a chapter of its name, it goes by its place, so the name never shows twice.
        header(byPlace: isExpanded && namedLikeAChapter, next: false)
      }
    }
  }

  @ViewBuilder
  private var chapterRows: some View {
    let rows = phase.chapters.filter { !$0.isWritingAhead }
    let window = planChapterWindow(states: rows.map(\.state))
    let hidden = rows.count - window.count

    let showsAll = disclosure.showsAllChapters

    ForEach(showsAll ? rows : Array(rows[window])) { chapter in
      PlanChapterRow(context: context, chapter: chapter)
    }

    if hidden > 0 {
      Button {
        store.setPhaseDisclosure(goalId: context.goal.id, phase: phase.index) {
          $0.showsAllChapters.toggle()
        }
      } label: {
        Label {
          showsAll
            ? Text(
              "Show fewer chapters", tableName: "Plan",
              comment: "Folds a phase's chapters back to the ones around the next")
            : Text(
              "\(hidden) more chapters", tableName: "Plan",
              comment: "Shows the phase's chapters left out around the next one")
        } icon: {
          Image(systemName: showsAll ? "minus" : "plus")
        }
      }
      .foregroundStyle(.mutedForeground)
    }
  }

  @ViewBuilder
  private var events: some View {
    if let checkpoint = phase.checkpoint {
      PlanCheckpointRow(
        checkpoint: checkpoint, explains: !brief, isLanguage: context.goal.kind == .language,
        today: context.plan.today)
    }
  }

  /// The phase's own chapter: a language's unit, or a course's chapter the phase is named after.
  /// Lessons still being written for it don't count as another chapter.
  private var ownChapter: PlanChapter? {
    let rows = phase.chapters.filter { !$0.writing || $0.far }

    guard rows.count == 1, let only = rows.first, only.chapterId != nil,
      Self.isSameName(only.title, phase.title)
    else {
      return nil
    }

    return only
  }

  private var namedLikeAChapter: Bool {
    phase.chapters.contains { Self.isSameName($0.title, phase.title) }
  }

  private static func isSameName(_ first: String, _ second: String) -> Bool {
    first.compare(second, options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive])
      == .orderedSame
  }

  private func header(byPlace: Bool, next: Bool) -> some View {
    PlanPathRow {
      Label {
        VStack(alignment: .leading, spacing: 2) {
          Text(
            byPlace
              ? String(
                localized: "Phase \(phase.index + 1)", table: "Plan",
                comment: "Name of an unnamed phase by its number")
              : phase.title
          )
          .typeWeight(phase.state == .current ? .semibold : .regular)
          .foregroundStyle(phase.state == .done ? .mutedForeground : .primary)

          if let meta {
            meta
              .typeStyle(.meta)
              .foregroundStyle(.mutedForeground)
          }
        }
      } icon: {
        StatusMark(status: next ? .next : phase.mark)
      }
    } value: {
      VStack(alignment: isStacked ? .leading : .trailing, spacing: 2) {
        // A phase not started shows only its end.
        if phase.lessonsTotal > 0, phase.state != .upcoming {
          Text(
            "\(phase.lessonsDone) / \(phase.lessonsTotal)", tableName: "Plan",
            comment: "Lessons done of a phase's lessons"
          )
          .monospacedDigit()
        }

        if let until {
          until
            .typeStyle(.meta)
        }
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(phase.state == .current ? youAreHere : Text(verbatim: ""))
  }

  private var youAreHere: Text {
    Text("You are here", tableName: "Plan", comment: "Spoken on the learner's current phase")
  }

  private var meta: Text? {
    switch phase.leftOut {
    case .notInPlan:
      return Text(
        "Not in your plan", tableName: "Plan", comment: "A phase the plan holds nothing of")
    case .lessons(let count):
      return Text(
        "\(count) lessons not studied", tableName: "Plan",
        comment: "A phase the date passed with lessons not studied")
    case .challenge, .noTimeForChallenge:
      return context.goal.kind == .language
        ? Text(
          "The call isn't in your plan", tableName: "Plan",
          comment: "A language phase whose closing call has no day in the plan")
        : Text(
          "The Trickster isn't in your plan", tableName: "Plan",
          comment:
            "A phase whose closing challenge has no day in the plan. The Trickster is the name of the challenge's character"
        )
    case nil:
      return phase.state == .current && !isOpen ? resumes : nil
    }
  }

  /// When its lessons continue; nothing while they're being written, which the learner can't act on.
  private var resumes: Text? {
    guard phase.lessonsDone < phase.lessonsTotal,
      let next = phase.chapters.filter({ $0.state != .done }).compactMap(\.nextDate).min()
    else {
      return nil
    }

    return next == context.plan.today
      ? Text(
        "Continues today", tableName: "Plan", comment: "When the current phase's lessons continue")
      : Text(
        "Continues \(PlanDate.text(next, today: context.plan.today))", tableName: "Plan",
        comment: "When the current phase's lessons continue; the argument is a date like 'May 5'")
  }

  private var until: Text? {
    guard let endDate = phase.untilDate, phase.state == .current || phase.state == .upcoming,
      !(isLast && phase.kind != .afterExam)
    else {
      return nil
    }

    let learns = phase.kind == .learn || phase.kind == .afterExam
    let today = context.plan.today

    if learns && phase.state == .upcoming {
      let month = PlanDate.monthText(endDate, today: today)

      return Text(
        LocalizedStringResource(
          "untilAboutMonth", defaultValue: "until ~\(month)", table: "Plan",
          comment:
            "When a phase ends, about; the argument is a month like 'Jan' or 'Jan 2028', never a day"
        )
      )
      .accessibilityLabel(
        Text(
          LocalizedStringResource(
            "untilAboutMonthSpoken", defaultValue: "until about \(month)", table: "Plan",
            comment:
              "When a phase ends, about, read aloud; the argument is a month like 'Jan' or 'Jan 2028', never a day"
          )))
    }

    let day = PlanDate.text(endDate, today: today)

    // The phase ends with its challenge, which has no booked day, only the plan's estimate.
    if learns && phase.checkpoint?.state == .upcoming {
      return Text(
        "until ~\(day)", tableName: "Plan",
        comment: "When a phase ends, about; the argument is a day like 'Nov 10'"
      )
      .accessibilityLabel(
        Text(
          "until about \(day)", tableName: "Plan",
          comment: "When a phase ends, about, read aloud; the argument is a day like 'Nov 10'"))
    }

    return Text(
      "until \(day)", tableName: "Plan",
      comment: "When a phase ends; the argument is a date like 'May 5'")
  }
}

private struct PlanChapterRow: View {
  let context: PlanContext
  let chapter: PlanChapter

  var body: some View {
    if let chapterId = chapter.chapterId {
      PlanRouteLink(route: route(chapterId)) {
        content
      }
    } else if chapter.far, let skillId = chapter.skillId {
      // Past the weeks the plan writes ahead: its outline is the learner's to ask for.
      Button {
        context.show(.farTopic(skillId: skillId, title: chapter.title))
      } label: {
        content
          .foregroundStyle(.primary)
          .disclosureChevron()
      }
    } else {
      content
        .foregroundStyle(.mutedForeground)
        .chevronSlot()
    }
  }

  private var content: some View {
    PlanPathRow {
      Label {
        VStack(alignment: .leading, spacing: 2) {
          title

          if let note {
            note
              .typeStyle(.meta)
              .foregroundStyle(.mutedForeground)
          }
        }
      } icon: {
        StatusMark(status: mark)
      }
    } value: {
      if chapter.lessonsTotal > 0, !chapter.writing, !chapter.isSkipped {
        Text(
          "\(chapter.lessonsDone) / \(chapter.lessonsTotal)", tableName: "Plan",
          comment: "Lessons done of a chapter's lessons"
        )
        .monospacedDigit()
      }
    }
  }

  private var title: Text {
    if !chapter.skills.isEmpty {
      return Text(
        "\(chapter.skills.count) topics you already know", tableName: "Plan",
        comment: "A row of topics placement showed the learner knows")
    }

    return chapter.title.isEmpty
      ? Text(
        "More lessons", tableName: "Plan",
        comment: "A chapter whose lessons are still being written")
      : Text(chapter.title)
  }

  private var note: Text? {
    if chapter.testedOut && chapter.skills.isEmpty {
      return Text(
        "Skipped\u{00A0}· you already know it", tableName: "Plan",
        comment: "A chapter the learner tested out of")
    }

    if chapter.deeper {
      return Text(
        "More on an earlier topic", tableName: "Plan",
        comment: "A chapter that goes further into an earlier one")
    }

    if chapter.chapterId == nil, chapter.far || chapter.writing {
      return planNotReadyLine(
        lessons: chapter.lessonsTotal, start: chapter.nextDate, today: context.plan.today)
    }

    return nil
  }

  private var mark: StatusMark.Status {
    if chapter.isSkipped {
      return .skipped
    }

    switch chapter.state {
    case .done: return .done
    case .current: return .next
    case .upcoming: return .todo
    }
  }

  private func route(_ chapterId: String) -> AppRoute {
    context.goal.kind == .language
      ? .languageUnit(chapterId: chapterId) : .chapter(chapterId: chapterId)
  }
}

private struct PlanCheckpointRow: View {
  let checkpoint: PlanPhase.Checkpoint
  let explains: Bool
  let isLanguage: Bool
  let today: String

  var body: some View {
    PlanRouteLink(route: .challenge(planItemId: checkpoint.planItemId)) {
      PlanChallengeLabel(
        when: when, explains: explains && checkpoint.state != .done, isLanguage: isLanguage)
    }
  }

  private var when: Text? {
    if checkpoint.state == .done {
      return Text("Won", tableName: "Plan", comment: "A phase challenge the learner won")
    }

    return checkpoint.whenText(today: today)
  }
}

extension PlanPhase.Checkpoint {
  /// When it comes. Dated today, the next session is today's, which may already be under way.
  func whenText(today: String) -> Text? {
    switch when {
    case .nextSession where date == today:
      Text("Today", tableName: "Plan", comment: "When the phase's challenge comes")
    case .nextSession:
      Text("In your next session", tableName: "Plan", comment: "When the phase's challenge comes")
    case .date, .queued:
      date.map { PlanDate.estimateText($0, today: today) }
    }
  }
}

extension PlanDate {
  static func estimate(_ isoDate: String, today: String, month: Bool = false) -> (
    text: String, spoken: String
  ) {
    let date = text(isoDate, today: today, month: month)

    let spoken =
      month
      ? String(
        localized: LocalizedStringResource(
          "aboutMonth", defaultValue: "About \(date)", table: "Plan",
          comment: "An estimated month, read aloud; the argument is a month like 'May 2027'"))
      : String(
        localized: "About \(date)", table: "Plan",
        comment: "An estimated day, read aloud; the argument is a day like 'Nov 20'")

    return (
      String(
        localized: "~\(date)", table: "Plan", comment: "An estimated day or month, like '~Nov 20'"),
      spoken
    )
  }

  static func estimateText(_ isoDate: String, today: String, month: Bool = false) -> Text {
    let date = estimate(isoDate, today: today, month: month)
    return Text(verbatim: date.text).accessibilityLabel(Text(verbatim: date.spoken))
  }
}

struct PlanSyllabusSection: View {
  let goalKind: LearnerGoal.Kind
  let syllabus: GoalSyllabus
  /// The exam's choices the plan follows, each named in a line with Change, as main's
  /// `PlanChoiceLines`; beside the page the plan's settings name them instead.
  var choices: [GoalPlan.ExamChoice] = []
  var change: (_ group: String) -> Void = { _ in }
  var focusTest: PlanFocusTestRow?

  var body: some View {
    let isExam = goalKind == .exam

    Section {
      SharedExamsNote(exams: syllabus.sharedExams)
      focusTest

      ForEach(choices) { choice in
        if let line = choice.followingLine {
          PlanChoiceLine(line: line) { change(choice.group) }
        }
      }

      ForEach(syllabus.subjects) { subject in
        NavigationLink(value: AppRoute.subject(subjectKey: subject.key)) {
          SyllabusSubjectRow(
            subject: subject, isExam: isExam, sharedExams: syllabus.sharedExams(of: subject))
        }
      }
    } header: {
      SectionTitle(
        isExam
          ? Text("Subjects", tableName: "Plan", comment: "Section of an exam's subjects")
          : Text("Modules", tableName: "Plan", comment: "Section of a plan's modules")
      ) {
        Group {
          if isExam {
            Text("Preparation", tableName: "Plan", comment: "What the subjects' bars measure")
          } else {
            Text("Lessons studied", tableName: "Plan", comment: "What the modules' bars measure")
          }
        }
        // Main's legend for the bars is quiet words, not a mono fact.
        .typeStyle(.small)
      }
    } footer: {
      SectionFooter {
        if isExam {
          Text(
            "\(syllabus.subjects.count) subjects", tableName: "Plan",
            comment: "How many subjects the exam has")
        } else {
          Text(
            "\(syllabus.subjects.count) modules", tableName: "Plan",
            comment: "How many modules the plan has")
        }
      }
    }
  }
}

/// Main's `PlanChoiceLine`: one sentence naming what the plan follows, with Change inline.
private struct PlanChoiceLine: View {
  let line: String
  let change: () -> Void

  var body: some View {
    let action = String(
      localized: "Change", table: "Plan",
      comment: "Opens the plan's settings to change the option of an exam's choice it follows")
    var link = AttributedString(action)
    link.link = URL(string: "zoonk-plan:change")
    link.foregroundColor = Color(.foreground)
    link.underlineStyle = .single

    return Text(AttributedString("\(line)\u{00A0}· ") + link)
      .typeStyle(.body)
      .foregroundStyle(.mutedForeground)
      .tint(Color(.foreground))
      .environment(
        \.openURL,
        OpenURLAction { _ in
          change()
          return .handled
        }
      )
      .accessibilityAction(named: Text(action)) { change() }
      .listRowSeparator(.hidden)
  }
}

/// Phones list the study places nowhere else, so the Plan's "More" leads to the lessons already
/// done and to the chapters' mind maps.
struct PlanStudyPlaceRows: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(\.tabBarPlacement) private var tabBarPlacement

  var body: some View {
    if tabBarPlacement?.listsStudyPlaces != true, let places = learner.summary.value?.places {
      if places.completedLessons {
        NavigationLink(value: AppRoute.completedLessons) {
          PlanPathLink(systemImage: "clock.arrow.circlepath") {
            Text(
              "Completed lessons", tableName: "Plan",
              comment: "Opens the page of the lessons the learner finished")
          }
        }
      }

      if places.mindMaps {
        NavigationLink(value: AppRoute.mindMaps()) {
          PlanPathLink(systemImage: LearnKind.mindMap.systemImage) {
            Text("Mind maps", tableName: "Plan", comment: "Opens the goal's mind maps")
          }
        }
      }
    }
  }
}

/// Main's `PathLinkRow`: a quiet way out of the path, in the secondary color.
struct PlanPathLink: View {
  let systemImage: String
  @ViewBuilder let title: Text

  var body: some View {
    Label {
      title
    } icon: {
      Image(systemName: systemImage)
    }
    .foregroundStyle(.mutedForeground)
  }
}

struct SyllabusSubjectRow: View {
  let subject: SyllabusSubject
  let isExam: Bool
  var sharedExams: [GoalSyllabus.SharedExam] = []

  var body: some View {
    let share = isExam ? (subject.preparation ?? 0) : subject.lessonShare

    VStack(alignment: .leading, spacing: 6) {
      PlanPathRow {
        VStack(alignment: .leading, spacing: 2) {
          Text(subject.name)
            .typeStyle(.rowTitle)
            .foregroundStyle(
              subject.notPlannedReason == nil ? Color(.foreground) : .mutedForeground)

          AlsoInExams(exams: sharedExams)
        }
      } value: {
        Text(share, format: .percent.precision(.fractionLength(0)))
          .typeStyle(.data)
      }

      if subject.notPlannedReason != nil {
        Text("Not in your plan", tableName: "Plan", comment: "A subject the plan leaves out")
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      } else {
        Meter(value: share, fill: .success)
          .accessibilityHidden(true)
      }
    }
    .accessibilityElement(children: .combine)
  }
}

/// The counts stay at the trailing edge beside a long name, which wraps; stacked, they go under it.
struct PlanPathRow<Title: View, Value: View>: View {
  @ViewBuilder let title: Title
  @ViewBuilder let value: Value

  var body: some View {
    AccessibilityStack(alignment: .firstTextBaseline, spacing: 12, stackedSpacing: 4) {
      title
        .frame(maxWidth: .infinity, alignment: .leading)

      value
        .foregroundStyle(.mutedForeground)
        .fixedSize()
    }
  }
}

extension View {
  /// A row without a chevron in a list where others have one keeps the chevron's slot, so values
  /// end on one edge.
  func chevronSlot() -> some View {
    HStack(spacing: 12) {
      self
      DisclosureChevron()
        .hidden()
    }
  }
}

/// A topic whose lessons aren't ready: how many it has and when it starts, else "Not ready yet".
func planNotReadyLine(lessons: Int, start: String?, today: String) -> Text {
  guard lessons > 0, let start else {
    return Text("Not ready yet", tableName: "Plan", comment: "A topic whose lessons aren't ready")
  }

  if PlanDate.days(from: today, to: start) > 31 {
    return Text(
      "\(lessons) lessons\u{00A0}· starts in \(PlanDate.monthText(start, today: today))",
      tableName: "Plan",
      comment: "A topic not ready yet: its lessons and the month they start, like 'Jan'")
  }

  return Text(
    "\(lessons) lessons\u{00A0}· starts \(PlanDate.text(start, today: today))", tableName: "Plan",
    comment: "A topic not ready yet: its lessons and the day they start, like 'May 5'")
}

/// Mirrors main's `getChapterWindow`: four chapters from the one before the next.
func planChapterWindow(states: [PlanChapter.State]) -> Range<Int> {
  let shown = 4
  let focus = states.firstIndex(of: .current) ?? states.firstIndex { $0 != .done } ?? -1
  let start = max(0, min(max(0, focus - 1), states.count - shown))

  return start..<min(states.count, start + shown)
}

/// Says what a challenge is under its row, since a learner meets one before they've ever taken one.
struct PlanChallengeLabel: View {
  let when: Text?
  let explains: Bool
  let isLanguage: Bool

  var body: some View {
    Label {
      VStack(alignment: .leading, spacing: 2) {
        AccessibilityStack(alignment: .firstTextBaseline) {
          Group {
            if isLanguage {
              Text("Call", tableName: "Plan", comment: "The live call that closes a language phase")
            } else {
              Text(
                "The Trickster", tableName: "Plan",
                comment:
                  "The challenge that closes a phase, named after its character, the Trickster")
            }
          }
          .foregroundStyle(.primary)
          .frame(maxWidth: .infinity, alignment: .leading)

          when?
            .foregroundStyle(.mutedForeground)
        }

        if explains {
          Group {
            if isLanguage {
              Text(
                "A live call where you get your point across", tableName: "Plan",
                comment: "What a language unit's challenge is, under its row")
            } else {
              Text(
                "Questions on this phase, with no hints", tableName: "Plan",
                comment: "What the Trickster is, under its row")
            }
          }
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
        }
      }
      // In a list row's button it otherwise gets one line's height and truncates its title.
      .fixedSize(horizontal: false, vertical: true)
    } icon: {
      KindMark(kind: .challenge)
    }
  }
}
