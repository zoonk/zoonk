import SwiftUI

/// Main's `RevealStructure`: everything the plan holds, in the groups the Plan shows it in: an
/// exam's subjects with their topics, or the path's phases with their chapters. Each group opens in
/// place, and nothing here leaves the screen: changing the plan is "Adjust plan".
struct RevealStructure: View {
  let context: PlanContext
  let syllabus: Resource<GoalSyllabus>
  /// What's open, kept above the panes so a rotation or a fold keeps it.
  @Binding var open: Set<String>

  var body: some View {
    switch syllabus.state {
    case .loaded(let syllabus) where syllabus.hasSubjectPages:
      RevealSubjects(goal: context.goal, syllabus: syllabus, open: $open)
    case .loaded, .empty, .failed:
      RevealPath(context: context, open: $open)
    case .idle, .loading:
      EmptyView()
    }
  }
}

private struct RevealPath: View {
  let context: PlanContext
  @Binding var open: Set<String>

  var body: some View {
    let phases = context.plan.phases

    if let only = phases.first {
      PageSection {
        if phases.count == 1, only.chapters.contains(where: { !$0.isWritingAhead }) {
          ForEach(only.chapters.filter { !$0.isWritingAhead }) { chapter in
            PlanChapterRow(context: context, chapter: chapter, opens: false)
          }
        } else {
          ForEach(phases) { phase in
            RevealPhaseRow(
              context: context, phase: phase, isExpanded: $open.contains("phase:\(phase.index)"))
          }
        }
      } header: {
        SectionTitle(
          Text(
            "Your path", tableName: "Plan", comment: "Section of the plan's phases and chapters"))
      }
    }
  }
}

/// Every chapter of the phase, with no fold and no challenge: the Plan says when each comes.
private struct RevealPhaseRow: View {
  let context: PlanContext
  let phase: PlanPhase
  @Binding var isExpanded: Bool

  var body: some View {
    let chapters = phase.chapters.filter { !$0.isWritingAhead }
    let label = PlanPhaseLabel(context: context, phase: phase)

    if chapters.isEmpty {
      label
    } else {
      DisclosureGroup(isExpanded: $isExpanded) {
        ForEach(chapters) { chapter in
          PlanChapterRow(context: context, chapter: chapter, opens: false)
        }
      } label: {
        label
      }
    }
  }
}

private struct RevealSubjects: View {
  let goal: LearnerGoal
  let syllabus: GoalSyllabus
  @Binding var open: Set<String>

  var body: some View {
    let groups = syllabus.subjectGroups

    ForEach(Array(groups.enumerated()), id: \.element.id) { index, group in
      PageSection {
        ForEach(group.subjects) { subject in
          RevealSubjectRow(goal: goal, subject: subject, open: $open)
        }
      } header: {
        VStack(alignment: .leading, spacing: 12) {
          if index == 0 {
            SectionTitle(
              syllabus.goal.kind == "exam"
                ? Text("Subjects", tableName: "Plan", comment: "Section of an exam's subjects")
                : Text("Modules", tableName: "Plan", comment: "Section of a plan's modules"))
          }

          if group.extra {
            SectionLabel(Text(syllabus.extraLabel))
          } else if let name = group.name {
            SectionLabel(Text(name))
          }
        }
      }
    }
  }
}

/// Opens in place to its topics by heading, each opening to its chapters, or straight to its
/// chapters when it has no topics.
private struct RevealSubjectRow: View {
  let goal: LearnerGoal
  let subject: SyllabusSubject
  @Binding var open: Set<String>

  /// Main shows the exam's question count from a 32rem column: a phone's has no room for it.
  @Environment(\.horizontalSizeClass) private var sizeClass

  var body: some View {
    if subject.topics.isEmpty && subject.chapters.isEmpty {
      label
    } else {
      DisclosureGroup(isExpanded: $open.contains("subject:\(subject.key)")) {
        if subject.topics.isEmpty {
          ForEach(subject.chapters) { chapter in
            Text(chapter.title)
              .foregroundStyle(.mutedForeground)
          }
        } else {
          ForEach(Array(headingRuns.enumerated()), id: \.offset) { _, run in
            if let heading = run.heading {
              SectionLabel(Text(heading))
                .listRowSeparator(.hidden)
            }

            ForEach(run.topics) { topic in
              SubjectTopicRow(
                goal: goal, topic: topic,
                isExpanded: $open.contains("topic:\(subject.key)/\(topic.id)"), opens: false
              )
              // A fold inside a fold's rows gets the system's style unless told again.
              .disclosureGroupStyle(.fold)
            }
          }
        }
      } label: {
        label
      }
    }
  }

  private var label: some View {
    ListRow(
      Text(subject.shortName)
        .foregroundStyle(subject.notPlannedReason == nil ? Color(.foreground) : .mutedForeground),
      description: line
    ) {
    } trailing: {
      if sizeClass == .regular, let questions = subject.questions, questions > 0 {
        Text(
          "\(questions) questions", tableName: "Plan",
          comment: "The number of questions in an exam or a mock exam.")
      }
    }
    .accessibilityElement(children: .combine)
  }

  /// Why it isn't in the plan, else how much it holds.
  private var line: Text? {
    if subject.notPlannedReason != nil {
      return planOutsideReason(subject.notPlannedReason, module: goal.kind != .exam)
    }

    if !subject.topics.isEmpty {
      return Text(
        "\(subject.topics.count) topics", tableName: "Plan",
        comment: "How many topics a subject has")
    }

    return subject.chapters.isEmpty
      ? nil
      : Text(
        "\(subject.chapters.count) chapters", tableName: "Plan",
        comment: "How many chapters a subject has")
  }

  private var headingRuns: [(heading: String?, topics: [SyllabusSubject.Topic])] {
    subject.topics.reduce(into: []) { runs, topic in
      if let last = runs.indices.last, runs[last].heading == topic.heading {
        runs[last].topics.append(topic)
      } else {
        runs.append((topic.heading, [topic]))
      }
    }
  }
}
