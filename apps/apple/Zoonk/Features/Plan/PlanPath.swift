import SwiftUI

/// A goal without subjects of its own (a language's units, one course's plan): its path.
struct PlanPathSection: View {
  @Environment(PlanStore.self) private var store

  let context: PlanContext

  var body: some View {
    let phases = context.plan.roadPhases
    let done = phases.filter { $0.state == .done }.count

    Section {
      if context.goal.kind == .language,
        let alphabet = store.languageUnits(goalId: context.goal.id).value?.alphabet
      {
        PlanAlphabetRow(alphabet: alphabet, goalId: context.goal.id)
      }

      PlanPathRows(context: context)
    } header: {
      HStack(alignment: .firstTextBaseline) {
        Text("Your path", tableName: "Plan", comment: "Section of the plan's phases and chapters")

        if phases.count > 1 {
          Spacer()
          Text(
            "\(done) of \(phases.count) phases done", tableName: "Plan",
            comment: "Phases done of the plan's phases"
          )
          .font(.footnote)
          .foregroundStyle(.secondary)
          .monospacedDigit()
        }
      }
    }
  }
}

/// The path as rows: each phase with its mark, its lessons done and when it ends, the goal last
/// (a phase after the exam follows it). The phase holding the next chapter is open, else the
/// current one; a phase that is only its own chapter (a language's unit) opens that page, and one
/// of several opens in place to them and its challenge.
struct PlanPathRows: View {
  let context: PlanContext

  var body: some View {
    let phases = context.plan.phases
    let open =
      (phases.first { phase in phase.chapters.contains { $0.state == .current } }
      ?? phases.first { $0.state == .current })?.index
    let beforeFinish = phases.filter { $0.kind != .afterExam }
    let last = beforeFinish.last?.index

    ForEach(beforeFinish) { phase in
      PlanPhaseRow(
        context: context, phase: phase, isOpen: phase.index == open, isLast: phase.index == last
      )
      .id("\(phase.index)-\(phase.index == open)")
    }

    LabeledContent {
      planFinishText(context)
    } label: {
      Label {
        Text(context.goal.title)
      } icon: {
        Image(systemName: "flag")
      }
    }

    ForEach(phases.filter { $0.kind == .afterExam }) { phase in
      PlanPhaseRow(context: context, phase: phase, isOpen: phase.index == open, isLast: false)
    }
  }
}

private struct PlanPhaseRow: View {
  @State private var isExpanded: Bool

  let context: PlanContext
  let phase: PlanPhase
  let isOpen: Bool
  let isLast: Bool

  init(context: PlanContext, phase: PlanPhase, isOpen: Bool, isLast: Bool) {
    self.context = context
    self.phase = phase
    self.isOpen = isOpen
    self.isLast = isLast
    _isExpanded = State(initialValue: isOpen)
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
    } else {
      DisclosureGroup(isExpanded: $isExpanded) {
        ForEach(phase.chapters) { chapter in
          PlanChapterRow(context: context, chapter: chapter)
        }

        events
      } label: {
        // Open over a chapter of its name, it goes by its place, so the name never shows twice.
        header(byPlace: isExpanded && namedLikeAChapter, next: false)
      }
    }
  }

  /// The challenge that closes the phase, and lessons still being written for it.
  @ViewBuilder
  private var events: some View {
    if let checkpoint = phase.checkpoint {
      PlanCheckpointRow(checkpoint: checkpoint, today: context.plan.today)
    }

    if phase.chapters.contains(where: { $0.writing && !$0.far }) {
      Text(
        "More lessons for this phase are being written.", tableName: "Plan",
        comment: "Note under a phase whose lessons are still being written"
      )
      .font(.footnote)
      .foregroundStyle(.secondary)
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
    LabeledContent {
      VStack(alignment: .trailing, spacing: 2) {
        if phase.lessonsTotal > 0 {
          Text(
            "\(phase.lessonsDone) / \(phase.lessonsTotal)", tableName: "Plan",
            comment: "Lessons done of a phase's lessons"
          )
          .monospacedDigit()
        }

        if let until {
          until
            .font(.caption)
        }
      }
    } label: {
      Label {
        VStack(alignment: .leading, spacing: 2) {
          Text(
            byPlace
              ? String(
                localized: "Phase \(phase.index + 1)", table: "Plan",
                comment: "Name of an unnamed phase by its number")
              : phase.title
          )
          .fontWeight(phase.state == .current ? .semibold : .regular)
          .foregroundStyle(phase.state == .done ? .secondary : .primary)

          if let meta {
            meta
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
      } icon: {
        StatusMark(status: next ? .next : mark)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(phase.state == .current ? youAreHere : Text(verbatim: ""))
  }

  private var youAreHere: Text {
    Text("You are here", tableName: "Plan", comment: "Spoken on the learner's current phase")
  }

  private var mark: StatusMark.Status {
    switch phase.state {
    case .done: .done
    case .current: .next
    case .leftOut, .unfinished, .upcoming: .todo
    }
  }

  /// Under the name, why the phase reads as it does: one the plan holds nothing of, one moved past
  /// with work set aside, or the current one, closed while the next chapter is in a later phase,
  /// saying when its lessons continue or when its challenge comes.
  private var meta: Text? {
    switch phase.state {
    case .leftOut:
      return Text(
        "Not in your plan", tableName: "Plan", comment: "A phase the plan holds nothing of")
    case .unfinished:
      let leftOut = phase.lessonsTotal - phase.lessonsDone

      return leftOut > 0
        ? Text(
          "\(leftOut) lessons were left out", tableName: "Plan",
          comment: "A phase moved past with lessons set aside")
        : Text(
          "Challenge left out", tableName: "Plan",
          comment: "A phase moved past with only its challenge set aside")
    case .current where !isOpen:
      return resumes
    case .current, .done, .upcoming:
      return nil
    }
  }

  private var resumes: Text? {
    let writing = phase.chapters.contains { $0.writing }
    let challenge =
      phase.checkpoint.flatMap { $0.state == .upcoming && $0.when == .date ? $0.date : nil }
      .map { PlanDate.text($0, today: context.plan.today) }

    if !writing && phase.lessonsDone < phase.lessonsTotal {
      guard
        let next = phase.chapters.filter({ $0.state != .done }).compactMap(\.nextDate).min()
      else {
        return nil
      }

      return next == context.plan.today
        ? Text(
          "Continues today", tableName: "Plan", comment: "When the current phase's lessons continue"
        )
        : Text(
          "Continues \(PlanDate.text(next, today: context.plan.today))", tableName: "Plan",
          comment: "When the current phase's lessons continue")
    }

    switch (writing, challenge) {
    case (true, let date?):
      return Text(
        "More lessons on the way · challenge \(date)", tableName: "Plan",
        comment: "The current phase's lessons are being written; its challenge's date")
    case (true, nil):
      return Text(
        "More lessons on the way", tableName: "Plan",
        comment: "The current phase's lessons are being written")
    case (false, let date?):
      return Text(
        "Lessons done · challenge \(date)", tableName: "Plan",
        comment: "The current phase's lessons are done; its challenge's date")
    case (false, nil):
      return nil
    }
  }

  /// "until Feb 5", or "until ~Feb" for a learning phase ahead, whose end is an estimate. Nothing
  /// for a phase done or set aside, nor for the last one, whose end the goal's row says.
  private var until: Text? {
    guard let endDate = phase.endDate, phase.state == .current || phase.state == .upcoming,
      !(isLast && phase.kind != .afterExam)
    else {
      return nil
    }

    if (phase.kind == .learn || phase.kind == .afterExam) && phase.state == .upcoming {
      return Text(
        "until ~\(PlanDate.monthText(endDate, today: context.plan.today))", tableName: "Plan",
        comment: "When a phase ends, about")
    }

    return Text(
      "until \(PlanDate.text(endDate, today: context.plan.today))", tableName: "Plan",
      comment: "When a phase ends")
  }
}

/// A chapter on the path: its mark, its title and lessons done, opening its page. Lessons still
/// being written have no page yet; far ones are an outline the learner can ask for.
private struct PlanChapterRow: View {
  @Environment(AppRouter.self) private var router
  @Environment(\.planSheetOpen) private var sheetOpen
  @State private var showsOutline = false
  @State private var pendingRoute: AppRoute?

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
        showsOutline = true
      } label: {
        content
          .foregroundStyle(.primary)
      }
      .sheet(isPresented: $showsOutline, onDismiss: openPendingRoute) {
        FarTopicSheet(goal: context.goal, skillId: skillId, title: chapter.title)
          .environment(
            \.planSheetOpen,
            PlanSheetOpen { route in
              pendingRoute = route
              showsOutline = false
            })
      }
    } else {
      content
        .foregroundStyle(.secondary)
    }
  }

  private func openPendingRoute() {
    guard let route = pendingRoute else {
      return
    }

    pendingRoute = nil

    if let sheetOpen {
      sheetOpen.open(route)
    } else {
      router.open(route)
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
          title

          if let note {
            note
              .font(.caption)
              .foregroundStyle(.secondary)
          }
        }
      } icon: {
        StatusMark(status: mark)
      }
    }
  }

  private var title: Text {
    chapter.title.isEmpty
      ? Text(
        "More lessons", tableName: "Plan",
        comment: "A chapter whose lessons are still being written")
      : Text(chapter.title)
  }

  private var note: Text? {
    if chapter.testedOut {
      return Text(
        "Skipped because you already know it", tableName: "Plan",
        comment: "A chapter the learner tested out of")
    }

    if chapter.deeper {
      return Text(
        "Going deeper into an earlier topic", tableName: "Plan",
        comment: "A chapter that deepens an earlier one")
    }

    if chapter.far && chapter.chapterId == nil {
      return Text(
        "Lessons on the way", tableName: "Plan", comment: "A far topic's lessons, not planned yet")
    }

    if chapter.writing && chapter.chapterId == nil {
      return Text(
        "Being written", tableName: "Plan",
        comment: "A chapter whose lessons are still being written")
    }

    return nil
  }

  private var mark: StatusMark.Status {
    if chapter.testedOut {
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

/// The challenge that closes a phase: won, or when it comes; it opens its intro.
private struct PlanCheckpointRow: View {
  let checkpoint: PlanPhase.Checkpoint
  let today: String

  var body: some View {
    PlanRouteLink(route: .challenge(planItemId: checkpoint.planItemId)) {
      LabeledContent {
        when
      } label: {
        Label {
          Text("Phase challenge", tableName: "Plan", comment: "The challenge that closes a phase")
        } icon: {
          KindMark(kind: .challenge)
        }
      }
    }
  }

  private var when: Text? {
    if checkpoint.state == .done {
      return Text("Won", tableName: "Plan", comment: "A phase challenge the learner won")
    }

    switch checkpoint.when {
    case .nextSession:
      return Text(
        "In your next session", tableName: "Plan", comment: "When the phase's challenge comes")
    case .queued:
      return Text(
        "After the challenge before it", tableName: "Plan",
        comment: "When the phase's challenge comes")
    case .date:
      return checkpoint.date.map { Text(PlanDate.text($0, today: today)) }
    }
  }
}

/// The goal's structure: an exam's subjects with their preparation, a plan's modules with their
/// lessons studied or known; each opens its page.
struct PlanSyllabusSection: View {
  let goalKind: LearnerGoal.Kind
  let syllabus: GoalSyllabus

  var body: some View {
    let isExam = goalKind == .exam

    Section {
      ForEach(syllabus.subjects) { subject in
        NavigationLink(value: AppRoute.subject(subjectKey: subject.key)) {
          SyllabusSubjectRow(subject: subject, isExam: isExam)
        }
      }
    } header: {
      HStack(alignment: .firstTextBaseline) {
        if isExam {
          Text("Subjects", tableName: "Plan", comment: "Section of an exam's subjects")
        } else {
          Text("Modules", tableName: "Plan", comment: "Section of a plan's modules")
        }

        Spacer()

        Group {
          if isExam {
            Text("Preparation", tableName: "Plan", comment: "What the subjects' bars measure")
          } else {
            Text("Lessons studied", tableName: "Plan", comment: "What the modules' bars measure")
          }
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
      }
    } footer: {
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

/// A subject's name over a bar of its preparation (a module's lessons), with its share at the end.
/// One the plan leaves out says so.
struct SyllabusSubjectRow: View {
  let subject: SyllabusSubject
  let isExam: Bool

  var body: some View {
    let share = isExam ? (subject.preparation ?? 0) : subject.lessonShare

    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline) {
        Text(subject.name)
          .foregroundStyle(subject.notPlannedReason == nil ? .primary : .secondary)

        Spacer()

        Text(share, format: .percent.precision(.fractionLength(0)))
          .font(.subheadline)
          .monospacedDigit()
          .foregroundStyle(.secondary)
      }

      if subject.notPlannedReason != nil {
        Text("Not in your plan", tableName: "Plan", comment: "A subject the plan leaves out")
          .font(.caption)
          .foregroundStyle(.secondary)
      } else {
        ProgressView(value: share)
          .tint(.success)
          .accessibilityHidden(true)
      }
    }
    .accessibilityElement(children: .combine)
  }
}
