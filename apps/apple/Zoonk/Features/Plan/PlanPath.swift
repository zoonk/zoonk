import SwiftUI

/// A goal without subjects of its own (a language's units, one course's plan): its path.
struct PlanPathSection: View {
  let context: PlanContext

  var body: some View {
    let phases = context.plan.roadPhases
    let done = phases.filter { $0.state == .done }.count

    Section {
      PlanPathRows(context: context)
    } header: {
      HStack(alignment: .firstTextBaseline) {
        Text("Your path", tableName: "Plan", comment: "Section of the plan's phases and chapters")

        if phases.count > 1 {
          Spacer()
          Text(
            "\(done) of ^[\(phases.count) phase](inflect: true) done", tableName: "Plan",
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

/// The path as rows: each phase with its mark, its lessons done and when it ends, opening in place
/// to its chapters and its challenge (the current one open); the goal last. A language's unit is a
/// phase of its own and opens its page.
struct PlanPathRows: View {
  let context: PlanContext

  var body: some View {
    ForEach(context.plan.phases.filter { $0.state != .leftOut }) { phase in
      PlanPhaseRow(context: context, phase: phase)
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
  }
}

private struct PlanPhaseRow: View {
  @State private var isExpanded: Bool

  let context: PlanContext
  let phase: PlanPhase

  init(context: PlanContext, phase: PlanPhase) {
    self.context = context
    self.phase = phase
    _isExpanded = State(initialValue: phase.state == .current)
  }

  var body: some View {
    if context.goal.kind == .language, phase.chapters.count == 1, let unit = phase.chapters.first,
      let chapterId = unit.chapterId
    {
      PlanRouteLink(route: .languageUnit(chapterId: chapterId)) {
        header
      }
    } else if phase.chapters.isEmpty && phase.checkpoint == nil {
      header
    } else {
      DisclosureGroup(isExpanded: $isExpanded) {
        ForEach(phase.chapters) { chapter in
          PlanChapterRow(context: context, chapter: chapter)
        }

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
      } label: {
        header
      }
    }
  }

  private var header: some View {
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
        Text(phase.title)
          .fontWeight(phase.state == .current ? .semibold : .regular)
      } icon: {
        StatusMark(status: mark)
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

  /// "until Feb 5", or "until ~Feb 5" when the phase ends on an estimate.
  private var until: Text? {
    guard let endDate = phase.endDate, phase.state != .done else {
      return nil
    }

    let date = PlanDate.text(endDate, today: context.plan.today)

    return context.plan.schedule.targetDateEstimated
      ? Text("until ~\(date)", tableName: "Plan", comment: "When a phase ends, about")
      : Text("until \(date)", tableName: "Plan", comment: "When a phase ends")
  }
}

/// A chapter on the path: its mark, its title and lessons done, opening its page. Lessons still
/// being written have no page yet; far ones are an outline the learner can ask for.
private struct PlanChapterRow: View {
  let context: PlanContext
  let chapter: PlanChapter

  var body: some View {
    if let chapterId = chapter.chapterId {
      PlanRouteLink(route: route(chapterId)) {
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
          "^[\(syllabus.subjects.count) subject](inflect: true)", tableName: "Plan",
          comment: "How many subjects the exam has")
      } else {
        Text(
          "^[\(syllabus.subjects.count) module](inflect: true)", tableName: "Plan",
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
