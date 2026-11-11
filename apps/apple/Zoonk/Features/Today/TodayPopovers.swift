import SwiftUI

/// Main's small popover on a part of Today's day bar or a day of its week: what it is, its time and
/// a note.
struct TodayFactsPopover: View {
  let title: String
  var kind: LearnKind?
  let facts: String?
  var factsStyle = Color.mutedForeground
  let note: String?
  /// The week's challenge on the day, under the rest.
  var challenge: (kind: LearnKind, name: String)?

  var body: some View {
    // A popover takes its content's ideal size, and at the largest text sizes it can outgrow the
    // room under its source.
    ScrollView {
      VStack(alignment: .leading, spacing: 6) {
        VStack(alignment: .leading, spacing: 2) {
          HStack(alignment: .firstTextBaseline, spacing: 6) {
            if let kind {
              KindMark(kind: kind)
            }

            Text(title)
          }
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))
          .accessibilityAddTraits(.isHeader)

          if let facts {
            Text(facts)
              .typeStyle(.data)
              .foregroundStyle(factsStyle)
          }
        }

        if let note {
          Text(note)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }

        if let challenge {
          HStack(alignment: .firstTextBaseline, spacing: 6) {
            KindMark(kind: challenge.kind)
            Text(challenge.name)
          }
          .typeStyle(.meta)
          .foregroundStyle(Color(.foreground))
        }
      }
      .frame(width: 256, alignment: .leading)
      .padding(.horizontal)
      .padding(.vertical, 12)
    }
    .scrollBounceBehavior(.basedOnSize)
    .presentationCompactAdaptation(.popover)
    .zoonkStyles()
  }
}

/// Main's `DayProgress`: the day's meter, where each part opens what it stands for.
struct DayProgressRow: View {
  let session: StudyDay
  let writingStalled: Bool

  /// The bar is thin, so each part's control reaches above and below it.
  private let tapHeight = 44.0

  var body: some View {
    let segments = session.daySegments

    DaySegments(segments: segments.map(\.mark))
      .overlay {
        // Equal parts, so the controls line up with them the way the bar lays them out.
        HStack(spacing: DaySegments.gap) {
          ForEach(segments.indices, id: \.self) { index in
            DaySegmentButton(
              segment: segments[index], writingStalled: writingStalled,
              barHeight: DaySegments.height
            )
            .frame(maxWidth: .infinity)
            .frame(height: tapHeight)
          }
        }
      }
      .accessibilityElement(children: .contain)
      .accessibilityLabel(
        Text(
          "\(session.sessionBar.completed) of \(session.sessionBar.total) done",
          tableName: "Today", comment: "How far the day's session is"))
  }
}

private struct DaySegmentButton: View {
  let segment: DaySegment
  let writingStalled: Bool
  let barHeight: Double

  @State private var isShown = false

  var body: some View {
    Button {
      isShown = true
    } label: {
      Color.clear
        .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(segment.title)
    .accessibilityValue(segment.facts)
    .background {
      // Points the popover at the bar rather than the taller control around it.
      Color.clear
        .frame(height: barHeight)
        .popover(isPresented: $isShown, arrowEdge: .top) {
          TodayFactsPopover(
            title: segment.title, kind: segment.kind, facts: segment.facts,
            note: segment.note(writingStalled: writingStalled))
        }
    }
  }
}

// Mirrors main's `today-segment-popover.tsx`.
extension DaySegment {
  var kind: LearnKind {
    switch self {
    case .block(let block, _): block.learnKind
    case .held: .lesson
    }
  }

  var title: String {
    switch self {
    case .block(let block, _):
      block.displayTitle
    case .held:
      String(
        localized: "Your next lessons", table: "Today",
        comment: "Holds the place of the day's lessons that aren't written yet")
    }
  }

  var facts: String {
    switch self {
    case .block(_, .done):
      return String(localized: "Done", table: "Today", comment: "A finished block")
    case .block(let block, .ahead):
      return studyDuration(minutes: block.estimatedMinutes)
    case .block(let block, .current) where block.status == .active && block.answered > 0:
      return String(
        localized: "\(block.answered) of \(block.questions) questions", table: "Today",
        comment: "How far the learner is in the day's current block")
    case .block(let block, .current):
      return [
        String(localized: "Up next", table: "Today", comment: "The day's next block"),
        studyDuration(minutes: block.estimatedMinutes),
      ].joinedFacts()
    case .held(let minutes, _):
      return studyDuration(minutes: minutes)
    }
  }

  func note(writingStalled: Bool) -> String? {
    switch self {
    case .block(let block, _):
      block.learnKind.purpose
    case .held(_, .toPrepare):
      String(
        localized: "Not written yet.", table: "Today",
        comment: "The day's next lessons, which nobody is writing yet")
    case .held(_, .beingWritten) where writingStalled:
      String(
        localized: "Taking longer than usual", table: "Today",
        comment: "The day's next lessons are taking long to outline")
    case .held(_, .beingWritten):
      String(
        localized: "Being written for you…", table: "Today",
        comment:
          "Under a lesson, or under the day's next lessons, while they're written right now. It can be one lesson or several."
      )
    }
  }
}

extension LearnKind {
  /// What a kind of the day's work is for; a lesson needs no saying.
  fileprivate var purpose: String? {
    switch self {
    case .review:
      String(
        localized: "Brings back what you studied before you forget it.", table: "Today",
        comment: "What a review in the day's session is for")
    case .practice:
      String(
        localized: "New questions that mix what you've learned.", table: "Today",
        comment: "What a practice in the day's session is for")
    case .mistakes:
      String(
        localized: "Another try at questions you missed.", table: "Today",
        comment: "What a mistakes practice in the day's session is for")
    case .challenge:
      String(
        localized: "Checks what you've learned so far.", table: "Today",
        comment: "What a challenge in the day's session is for")
    case .mock:
      String(
        localized: "A practice exam, like the real one.", table: "Today",
        comment: "What a mock exam in the day's session is for")
    case .essay:
      String(
        localized: "You put what you learned into your own words.", table: "Today",
        comment: "What a writing block in the day's session is for")
    case .conversation, .lesson, .mindMap:
      nil
    }
  }
}
