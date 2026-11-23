import SwiftUI

struct PlanPathSection: View {
  @Environment(PlanStore.self) private var store

  let context: PlanContext
  var course: GoalPlan.Course?
  var testRow: PlanTestRow?

  var body: some View {
    // Main's order: the test of what the learner knows heads the path in its own group, since a
    // row without a mark and the path's marked rows don't share one label edge.
    if let testRow {
      PageSection {
        testRow
      } header: {
        title
      }

      PageSection {
        rows
      } header: {
        EmptyView()
      }
    } else {
      PageSection {
        rows
      } header: {
        title
      }
    }
  }

  private var title: some View {
    SectionTitle(
      Text("Your path", tableName: "Plan", comment: "Section of the plan's phases and chapters"))
  }

  @ViewBuilder private var rows: some View {
    if context.goal.kind == .language,
      let alphabet = store.languageUnits(goalId: context.goal.id).value?.alphabet
    {
      PlanAlphabetRow(alphabet: alphabet, goalId: context.goal.id, skip: context.alphabetSkip)
    }

    PlanPathRows(context: context)

    if let course {
      PageLink(route: .course(courseId: course.courseId, title: course.title)) {
        PlanPathLink(systemImage: "books.vertical") {
          Text(
            "See the full course", tableName: "Plan",
            comment: "Opens the Library course the plan is built from")
        }
      }
    }
  }
}

struct PlanPathRows: View {
  let context: PlanContext

  var body: some View {
    let phases = context.plan.phases
    let open =
      (phases.first { phase in phase.chapters.contains { $0.state == .current } }
      ?? phases.first { $0.state == .current })?.index
    let beforeFinish = phases.filter { $0.kind != .afterExam }

    ForEach(beforeFinish) { phase in
      PlanPhaseRow(
        context: context, phase: phase, isOpen: phase.index == open)
    }

    PlanMarkedRow(title: Text(context.goal.displayName), when: planFinish(context)) {
      Image(systemName: "flag")
    }

    ForEach(phases.filter { $0.kind == .afterExam }) { phase in
      PlanPhaseRow(
        context: context, phase: phase, isOpen: phase.index == open)
    }
  }
}

extension PlanPhase {
  var mark: StatusMark.Status {
    switch state {
    case .done: .done
    case .current: .currentPhase
    case .leftOut, .unfinished, .upcoming: .todo
    }
  }
}

private struct PlanPhaseRow: View {
  @Environment(PlanStore.self) private var store

  let context: PlanContext
  let phase: PlanPhase
  let isOpen: Bool

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
        header(next: own.state == .current)
      }
      .currentRow(own.state == .current)

      if isOpen {
        events
      }
    } else if phase.chapters.isEmpty && phase.checkpoint == nil {
      header(next: false)
    } else {
      DisclosureGroup(isExpanded: expansion) {
        chapterRows
        events
      } label: {
        // Open, a phase named like one of its chapters goes by its place, so the two rows don't read
        // the same; the current phase keeps its name, as main's does.
        header(
          next: false,
          byPlace: isExpanded && phase.state != .current
            && phase.chapters.contains { Self.isSameName($0.title, phase.title) })
      }
      .disclosureGroupStyle(.foldUnderLabel)
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
      MoreRowsFold(
        words: foldLabel(hidden: hidden, showsAll: showsAll),
        isUnfolded: Binding {
          showsAll
        } set: { shows in
          store.setPhaseDisclosure(goalId: context.goal.id, phase: phase.index) {
            $0.showsAllChapters = shows
          }
        })
    }
  }

  private func foldLabel(hidden: Int, showsAll: Bool) -> Text {
    switch (context.goal.kind == .language, showsAll) {
    case (true, true):
      Text("Show fewer units", tableName: "Plan")
    case (true, false):
      Text("\(hidden) more units", tableName: "Plan")
    case (false, true):
      Text(
        "Show fewer chapters", tableName: "Plan",
        comment: "Folds a phase's chapters back to the ones around the next")
    case (false, false):
      Text(
        "\(hidden) more chapters", tableName: "Plan",
        comment: "Shows the phase's chapters left out around the next one")
    }
  }

  @ViewBuilder
  private var events: some View {
    if let checkpoint = phase.checkpoint {
      PlanCheckpointRow(
        checkpoint: checkpoint, isLanguage: context.goal.kind == .language,
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

  private static func isSameName(_ first: String, _ second: String) -> Bool {
    first.compare(second, options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive])
      == .orderedSame
  }

  private func header(next: Bool, byPlace: Bool = false) -> some View {
    PlanPhaseLabel(
      context: context, phase: phase, description: meta, next: next, byPlace: byPlace)
  }

  private var meta: Text? {
    switch phase.leftOut {
    case .notInPlan:
      return planOutsideReason(phase.notPlannedReason)
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
    guard !context.isPaused, phase.lessonsDone < phase.lessonsTotal,
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
}

/// A phase's row on the path: its mark, its name over a line, and when it ends.
struct PlanPhaseLabel: View {
  @Environment(\.legibilityWeight) private var legibilityWeight

  let context: PlanContext
  let phase: PlanPhase
  var description: Text?
  var next = false
  /// "Phase 2", for a phase named like one of the chapters under it.
  var byPlace = false

  var body: some View {
    let title = Text(byPlace ? phase.placeName : phase.title)
      .typeWeight(.medium, legibility: legibilityWeight)
      .foregroundStyle(phase.state == .done ? Color.mutedForeground : Color(.foreground))

    ListRow(title, description: description) {
      StatusMark(status: next ? .next : phase.mark)
    } trailing: {
      if let end {
        Text(verbatim: end.shown)
          .typeStyle(.data)
          .layoutRole(.date)
          .accessibilityHidden(true)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(Text(verbatim: spokenState))
  }

  private var end: PhaseEnd? {
    context.isPaused ? nil : context.plan.phaseEnd(phase)
  }

  /// "You are here" on the current phase, then its end.
  private var spokenState: String {
    let here =
      phase.state == .current
      ? String(
        localized: "You are here", table: "Plan", comment: "Spoken on the learner's current phase")
      : nil

    return [here, end?.spoken].compactMap(\.self).joined(separator: ", ")
  }
}

struct PlanChapterRow: View {
  let context: PlanContext
  let chapter: PlanChapter
  /// A new plan's path only says what's there: none of its chapters opens.
  var opens = true

  var body: some View {
    if !opens {
      content(isMuted: chapter.state == .done)
    } else if let chapterId = chapter.chapterId {
      PlanRouteLink(route: route(chapterId)) {
        content(isMuted: false)
      }
      .currentRow(chapter.state == .current)
    } else if chapter.far, let skillId = chapter.skillId {
      // Past the weeks the plan writes ahead: its outline is the learner's to ask for.
      Button {
        context.show(.farTopic(skillId: skillId, title: chapter.title))
      } label: {
        content(isMuted: false)
          .disclosureChevron()
      }
    } else {
      content(isMuted: true)
    }
  }

  /// A chapter the learner can't open yet is quiet.
  private func content(isMuted: Bool) -> some View {
    ListRow(
      title.foregroundStyle(isMuted ? Color.mutedForeground : Color(.foreground)),
      description: note
    ) {
      StatusMark(status: mark)
    } trailing: {
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel { label in
      if let markWords {
        Text(markWords)
      }

      label
    }
  }

  /// What the mark says, read before the title: the row has no count.
  private var markWords: LocalizedStringResource? {
    switch mark {
    case .next:
      LocalizedStringResource(
        "chapterMarkNext", defaultValue: "Up next", table: "Plan",
        comment: "Spoken on the path's next chapter, before its title")
    case .done:
      LocalizedStringResource(
        "chapterMarkDone", defaultValue: "Done", table: "Plan",
        comment: "Spoken on a done chapter, before its title")
    case .skipped:
      LocalizedStringResource(
        "chapterMarkSkipped", defaultValue: "Skipped", table: "Plan",
        comment: "Spoken on a chapter the learner already knew, before its title")
    case .todo where chapter.lessonsDone > 0 && chapter.lessonsTotal > 0 && !chapter.writing:
      LocalizedStringResource(
        "\(chapter.lessonsDone) of \(chapter.lessonsTotal) lessons done", table: "Plan",
        locale: .appLanguage, comment: "Spoken on a started chapter, before its title")
    case .todo, .currentPhase:
      nil
    }
  }

  private var title: Text {
    if !chapter.skills.isEmpty {
      return Text(
        "\(chapter.skills.count) chapters you already know", tableName: "Plan")
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
  let isLanguage: Bool
  let today: String

  var body: some View {
    PlanRouteLink(route: .challenge(planItemId: checkpoint.planItemId)) {
      PlanChallengeLabel(
        when: when, explains: checkpoint.state != .done, isLanguage: isLanguage)
    }
  }

  private var when: PlanWhen? {
    if checkpoint.state == .done {
      return .words(Text("Won", tableName: "Plan", comment: "A phase challenge the learner won"))
    }

    return checkpoint.when(today: today)
  }
}

extension PlanPhase.Checkpoint {
  /// When it comes. Dated today, the next session is today's, which may already be under way.
  func when(today: String) -> PlanWhen? {
    switch when {
    case .nextSession where date == today:
      .words(Text("Today", tableName: "Plan", comment: "When the phase's challenge comes"))
    case .nextSession:
      .words(
        Text("In your next session", tableName: "Plan", comment: "When the phase's challenge comes")
      )
    case .date, .queued:
      date.map { .date(PlanDate.estimateText($0, today: today)) }
    }
  }
}

/// When something on the path comes: a date in the data face, like the phases' ends beside it, and
/// words in the text face at the date's size.
enum PlanWhen: View {
  case date(Text)
  case words(Text)

  var body: some View {
    switch self {
    case .date(let text): text.typeStyle(.data).layoutRole(.date)
    case .words(let text): text.typeStyle(.meta).layoutRole(.words)
    }
  }

  var text: Text {
    switch self {
    case .date(let text), .words(let text): text
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
  var testRow: PlanTestRow?

  var body: some View {
    let isExam = goalKind == .exam

    // Main's order: the focus test, then the plan's choices, above the subjects and not among them,
    // since neither is a subject with a preparation. Each is its own group: a row with a mark and a
    // sentence don't share one label edge.
    if let testRow {
      PageSection {
        testRow
      } header: {
        EmptyView()
      }
    }

    if choices.contains(where: { $0.followingLine != nil }) {
      PageSection {
        ForEach(choices) { choice in
          if let line = choice.followingLine {
            PlanChoiceLine(line: line) { change(choice.group) }
          }
        }
      } header: {
        EmptyView()
      }
    }

    PageSection {
      SharedExamsNote(exams: syllabus.sharedExams)

      // Main's groups: the notice's in its order, then the optional study.
      ForEach(syllabus.subjectGroups) { group in
        if group.extra {
          SectionLabel(Text(syllabus.extraLabel))
            .listRowSeparator(.hidden)
        } else if let name = group.name {
          SectionLabel(Text(name))
            .listRowSeparator(.hidden)
        }

        ForEach(group.subjects) { subject in
          PageLink(route: .subject(subjectKey: subject.key)) {
            SyllabusSubjectRow(
              subject: subject, isExam: isExam, sharedExams: syllabus.sharedExams(of: subject))
          }
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
        // Over the values' column: the rows keep the chevron's room after their values.
        .chevronSlot()
      }
    } footer: {
      SectionFooter {
        VStack(alignment: .leading, spacing: 0) {
          count
          SyllabusSources(syllabus: syllabus)
        }
      }
    }
  }

  /// Main's `useSectionCount`: the notice's own subjects, as the reveal counts them, with its topics;
  /// the learner's material counts its topics.
  @ViewBuilder private var count: some View {
    let subjects = syllabus.subjects.filter { $0.source == "notice" }.count

    if syllabus.fromMaterial {
      Text(
        "\(syllabus.topicCount > 0 ? syllabus.topicCount : subjects) topics from your material",
        tableName: "Plan",
        comment: "How many topics a plan built from the learner's own material holds")
    } else if syllabus.kind == "notice" && syllabus.topicCount > 0 {
      FactSegments([
        subjectsText(subjects),
        String(
          localized: "\(syllabus.topicCount) topics", table: "Plan",
          locale: .appLanguage, comment: "How many topics a subject has"),
      ])
    } else if goalKind == .exam {
      Text(
        verbatim: subjectsText(
          syllabus.kind == "notice" ? subjects : syllabus.subjects.count(where: { !$0.isExtra })))
    } else {
      Text(
        "\(syllabus.subjects.count) modules", tableName: "Plan",
        comment: "How many modules the plan has")
    }
  }

  private func subjectsText(_ count: Int) -> String {
    String(
      localized: "\(count) subjects", table: "Plan", locale: .appLanguage,
      comment: "How many subjects the exam has")
  }
}

/// Main's quiet "Sources": where the subjects' question counts and the course's weights come from,
/// for the learner who wants to check.
private struct SyllabusSources: View {
  let syllabus: GoalSyllabus

  var body: some View {
    if syllabus.questionsSource != nil || syllabus.courseWeights?.source != nil {
      QuietDisclosure(label: Text("Sources", tableName: "Plan")) {
        VStack(alignment: .leading, spacing: 8) {
          if let source = syllabus.questionsSource {
            QuestionsSourceText(edition: source.edition, url: source.url)
          }

          if let weights = syllabus.courseWeights {
            CourseWeightsText(subjects: syllabus.subjects, weights: weights)
          }
        }
        .tint(.mutedForeground)
      }
    }
  }
}

/// Main's `CourseWeightsNote`: how the learner's course weighs the exam's parts, which the plan's
/// time follows, its source linked.
private struct CourseWeightsText: View {
  let subjects: [SyllabusSubject]
  let weights: GoalSyllabus.CourseWeights

  var body: some View {
    if let sentence {
      Text(sentence)
    }
  }

  private var sentence: AttributedString? {
    guard let source = weights.source, let url = URL(string: source.url) else {
      return nil
    }

    let publisher = sourceHost(url)
    let lightest = weights.subjects.map(\.weight).min() ?? 0
    let heavier = weights.subjects.filter { $0.weight > lightest }.map { part in
      subjects.first { $0.name == part.name }?.shortName ?? part.name
    }
    let sentence =
      heavier.isEmpty
      ? String(
        localized:
          "\(weights.course) at \(weights.institution) counts every part of the exam the same. Weights from \(publisher).",
        table: "Plan",
        comment:
          "How the learner's course weighs an exam's parts, all the same; the last argument is the source's site"
      )
      : String(
        localized:
          "\(weights.course) at \(weights.institution) counts \(heavier.formatted(.list(type: .and))) more, so your plan gives them more of your time. Weights from \(publisher).",
        table: "Plan",
        comment:
          "How the learner's course weighs an exam's parts: the ones counted more; the last argument is the source's site"
      )
    var text = AttributedString(sentence)

    if let range = text.range(of: publisher, options: .backwards) {
      text[range].link = url
      text[range].underlineStyle = .single
    }

    return text
  }
}

/// Main's `PlanChoiceLine`: one sentence naming what the plan follows, with Change inline.
/// Main's `PlanChoiceLine`: which option of an exam's choice the plan follows, with Change as a
/// link at its end.
struct PlanChoiceLine: View {
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
/// done and to the chapters' mind maps, drawn as its other places are.
struct PlanStudyPlaceRows: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(\.tabBarPlacement) private var tabBarPlacement

  var body: some View {
    if tabBarPlacement?.listsStudyPlaces != true, let places = learner.summary.value?.places {
      if places.completedLessons {
        PageLink(route: .completedLessons) {
          Label {
            Text(
              "Completed lessons", tableName: "Plan",
              comment: "Opens the page of the lessons the learner finished")
          } icon: {
            Image(systemName: "clock.arrow.circlepath")
          }
        }
      }

      if places.mindMaps {
        PageLink(route: .mindMaps()) {
          Label {
            Text("Mind maps", tableName: "Plan", comment: "Opens the goal's mind maps")
          } icon: {
            Image(systemName: LearnKind.mindMap.systemImage)
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
    ListRow(title.foregroundStyle(.mutedForeground)) {
      Image(systemName: systemImage)
        .imageScale(.small)
    }
  }
}

struct SyllabusSubjectRow: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibilityWeight
  @Environment(\.stacksContent) private var isStacked

  let subject: SyllabusSubject
  let isExam: Bool
  var sharedExams: [GoalSyllabus.SharedExam] = []

  /// Main's container widths: the bar beside the name from 32rem, the question count too from 42rem.
  @State private var width: CGFloat = 0
  private static let barBesideFrom: CGFloat = 512
  private static let questionsFrom: CGFloat = 672

  var body: some View {
    let share = isExam ? (subject.preparation ?? 0) : subject.lessonShare
    // The exam doesn't test its optional study, so its row counts lessons where others measure.
    let measured = subject.notPlannedReason == nil && !subject.isExtra
    let isWide = !isStacked && width >= Self.barBesideFrom

    // The bar is part of the row's words, so the share centers on the row with the chevron the
    // list draws after it, as main's subject row does.
    RowLayout {
    } words: {
      if isWide {
        HStack(spacing: 14) {
          name
            .frame(maxWidth: .infinity, alignment: .leading)

          if width >= Self.questionsFrom {
            questions
              .frame(width: 104, alignment: .trailing)
          }

          if measured {
            Meter(value: share, fill: .success)
              .frame(width: min(max(width * 0.3, 112), 224))
              .accessibilityHidden(true)
          }
        }
      } else {
        VStack(alignment: .leading, spacing: 6) {
          name

          if measured {
            Meter(value: share, fill: .success)
              .accessibilityHidden(true)
          }
        }
      }
    } value: {
      if !subject.isExtra {
        // As wide as the widest share, so every subject's bar ends on one edge.
        Text(share, format: .percent.precision(.fractionLength(0)))
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
          .frame(
            minWidth: TypeStyle.data.width(
              of: 1.0.formatted(.percent.precision(.fractionLength(0)).locale(.appLanguage)),
              dynamicTypeSize: dynamicTypeSize, legibility: legibilityWeight),
            alignment: .trailing)
      }
    }
    .onGeometryChange(for: CGFloat.self) {
      $0.size.width
    } action: {
      width = $0
    }
    .accessibilityElement(children: .combine)
  }

  /// Its name, the other exams that share it, and why it isn't in the plan.
  private var name: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(subject.shortName)
        .typeStyle(.rowTitle)
        .foregroundStyle(
          subject.notPlannedReason == nil ? Color(.foreground) : .mutedForeground
        )
        .layoutPart(.label, text: Text(subject.shortName))

      AlsoInExams(exams: sharedExams)

      if subject.isExtra {
        Text("\(subject.lessonsDone) of \(subject.lessonsTotal) lessons", tableName: "Plan")
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }

      if subject.notPlannedReason != nil {
        planOutsideReason(subject.notPlannedReason)
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
    }
  }

  @ViewBuilder private var questions: some View {
    if let count = subject.questions, count > 0 {
      Text("\(count) questions", tableName: "Plan")
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)
        .lineLimit(1)
    }
  }
}

/// Main's `useFarTopicLine`: a topic whose lessons aren't ready, how many it has and when it starts
/// (its day this month, else its month), else "Not ready yet".
func planNotReadyLine(lessons: Int, start: String?, today: String) -> Text {
  guard lessons > 0, let start else {
    return Text("Not ready yet", tableName: "Plan", comment: "A topic whose lessons aren't ready")
  }

  if start.prefix(7) != today.prefix(7) {
    return Text(
      "\(lessons) lessons\u{00A0}· starts in \(PlanDate.monthText(start, today: today, wide: true))",
      tableName: "Plan",
      comment: "A topic not ready yet: its lessons and the month they start, like 'January'")
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

/// A path row with a mark and its date: the goal's finish, a mock exam, a review.
struct PlanMarkedRow<Mark: View>: View {
  let title: Text
  let when: PlanWhen?
  @ViewBuilder let mark: Mark

  var body: some View {
    ListRow(title) {
      mark
    } trailing: {
      when
    }
    .accessibilityElement(children: .combine)
  }
}

/// Says what a challenge is under its row, since a learner meets one before they've ever taken one.
/// Main's `PhaseCheckpointMark`: what ends a phase, a call for a language and the Trickster's face
/// otherwise.
struct PhaseCheckpointMark: View {
  let isLanguage: Bool

  @ScaledMetric(relativeTo: .body) private var faceSize = 20.0

  var body: some View {
    Group {
      if isLanguage {
        Image(systemName: "mic")
          .typeStyle(.rowTitle)
          .imageScale(.medium)
          .foregroundStyle(Color(.foreground))
      } else {
        TricksterCharacter(faceOnly: true)
          .frame(width: faceSize, height: faceSize)
      }
    }
    .accessibilityHidden(true)
  }
}

struct PlanChallengeLabel: View {
  let when: PlanWhen?
  let explains: Bool
  let isLanguage: Bool

  var body: some View {
    ListRow(name, description: explains ? explanation : nil) {
      PhaseCheckpointMark(isLanguage: isLanguage)
    } trailing: {
      when
    }
  }

  private var name: Text {
    isLanguage
      ? Text("Call", tableName: "Plan", comment: "The live call that closes a language phase")
      : Text(
        "The Trickster", tableName: "Plan",
        comment: "The challenge that closes a phase, named after its character, the Trickster")
  }

  private var explanation: Text {
    isLanguage
      ? Text(
        "A live call where you get your point across", tableName: "Plan",
        comment: "What a language unit's challenge is, under its row")
      : Text(
        "Questions on this phase, with no hints", tableName: "Plan",
        comment: "What the Trickster is, under its row")
  }
}

func planOutsideReason(_ reason: String?) -> Text {
  switch reason {
  case "skipped":
    Text(
      "Not in your plan\u{00A0}· you took this subject out", tableName: "Plan",
      comment:
        "Why a topic, subject or step on the path isn't in the learner's plan: they took its subject out."
    )
  case "known":
    Text("Skipped\u{00A0}· you already know it", tableName: "Plan")
  case "pastBasics":
    Text("Skipped\u{00A0}· you already know the basics", tableName: "Plan")
  case "skippedBase":
    Text("Skipped\u{00A0}· your choice", tableName: "Plan")
  case "missing":
    Text("Not ready yet", tableName: "Plan", comment: "A topic whose lessons aren't ready")
  case "time":
    Text(
      "Not in your plan\u{00A0}· other topics come first", tableName: "Plan",
      comment:
        "Why a topic, subject or step on the path isn't in the learner's plan: their study time goes to other topics first. Starts with the same words as \"Not in your plan · you took this subject out\"."
    )
  default:
    Text("Not in your plan", tableName: "Plan", comment: "A phase the plan holds nothing of")
  }
}

/// Main's name for the exam's optional study, such as its strategy: outside what the official
/// guide tests, or just optional when the exam has none.
func examExtraLabel(hasNotice: Bool, document: ExamDocument) -> String {
  guard hasNotice else {
    return String(
      localized: "Optional", table: "Plan",
      comment:
        "Labels an exam's optional study, such as its strategy, when the exam has no official guide"
    )
  }

  switch document {
  case .notice:
    return String(
      localized: LocalizedStringResource(
        "notInNotice", defaultValue: "Not in the official guide", table: "Plan",
        comment:
          "Labels an exam's optional study, such as its strategy, which the exam's public notice doesn't list"
      ))
  case .guide:
    return String(
      localized: "Not in the official guide", table: "Plan",
      comment:
        "Labels a language certificate's optional study, such as its strategy, which its official guide doesn't list"
    )
  }
}
