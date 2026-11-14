import SwiftUI

/// Core's `StudyDayProgress`: where today's session stands after a block, decided once for every
/// client.
struct DayProgress: Decodable, Hashable, Sendable {
  enum Lead: String, Decodable, Sendable {
    case done
    case left
    /// The day holds time for lessons not on the queue yet, so it has no honest total.
    case open
    case complete
  }

  /// Static: what the completion read, never counted down here.
  struct CatchUp: Decodable, Hashable, Sendable {
    let doneToday: Int
    let lessonsLeft: Int
  }

  let catchUp: CatchUp?
  let lead: Lead
  let lessonsComing: Bool
  let percent: Int?
}

struct SessionBar: Decodable, Hashable, Sendable {
  let completed: Int
  let total: Int
}

/// Main's catch-up line, the one caption under a block end's meter: small, never a readout.
struct CatchUpLine: View {
  let catchUp: DayProgress.CatchUp

  var body: some View {
    Group {
      if catchUp.doneToday == 0 {
        Text(
          "\(catchUp.lessonsLeft) lessons to catch up", tableName: "Session",
          comment: "Under a finished block's facts: lessons earlier days left, none caught up today"
        )
        .foregroundStyle(.mutedForeground)
      } else if catchUp.lessonsLeft == 0 {
        Label {
          Text(
            "No lessons left to catch up.", tableName: "Session",
            comment: "Under a finished block's facts: every lesson earlier days left is done")
        } icon: {
          StatusMark(status: .done)
        }
        .labelStyle(.titleAndIcon)
      } else {
        Text(caughtUpAndToGo)
      }
    }
    .typeStyle(.meta.monospacedDigit())
  }

  /// The gain in ink, what's left muted.
  private var caughtUpAndToGo: AttributedString {
    var rest = AttributedString("\u{00A0}· \(toGo)")
    rest.foregroundColor = .mutedForeground
    return AttributedString(caughtUp) + rest
  }

  private var caughtUp: String {
    String(
      localized: "\(catchUp.doneToday) caught up today", table: "Session",
      comment: "Earlier days' lessons the learner caught up on today")
  }

  private var toGo: String {
    String(
      localized: "\(catchUp.lessonsLeft) to go", table: "Session",
      comment: "Earlier days' lessons still to catch up, after how many were caught up today")
  }
}

/// Main's today block at a block's end: how much of today's session is done, as a count, a percent
/// and one equal segment per block.
struct DayProgressBlock: View {
  let moment: BlockMoment
  @Environment(\.celebrates) private var celebrates

  private var progress: DayProgress { moment.dayProgress }
  private var bar: SessionBar { moment.sessionBar }

  var body: some View {
    let segments = moment.daySegments

    VStack(alignment: .leading, spacing: 8) {
      VStack(alignment: .leading, spacing: 2) {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
          DayProgressLead(bar: bar, isOpen: progress.lead == .open)
            .frame(maxWidth: .infinity, alignment: .leading)

          if let percent = progress.percent {
            Text(Double(percent) / 100, format: .percent)
              .typeStyle(.data)
              .foregroundStyle(.mutedForeground)
          }
        }

      }
      .accessibilityElement(children: .combine)

      if segments.count >= 2 {
        DaySegments(segments: segments, finished: celebrates ? moment.finishedSegment : nil)
      }

      // At most one caption under the meter: catching up, else lessons still joining the day.
      if let catchUp = progress.catchUp {
        CatchUpLine(catchUp: catchUp)
      } else if progress.lead == .open, progress.lessonsComing {
        Text(
          "More as you go", tableName: "Session",
          comment: "At a block's end: today's next lessons are being written and join on their own"
        )
        .typeStyle(.meta)
        .foregroundStyle(.mutedForeground)
      }
    }
  }
}

/// What's done today, the number in bold: "2 of 3 done today", or "2 done today" while today's list
/// still grows.
struct DayProgressLead: View {
  let bar: SessionBar
  let isOpen: Bool

  var body: some View {
    lead
      .typeStyle(.body.monospacedDigit())
  }

  /// `AttributedString` parses the bold after the plural variant resolves; `Text`'s key doesn't.
  private var lead: Text {
    if isOpen {
      return Text(
        AttributedString(
          localized:
            "**\(bar.completed)** done today", table: "Session",
          comment:
            "At a block's end on a day still holding time for lessons not listed yet: blocks done today. Keep the ** around the number: it shows in bold."
        ))
    }

    return Text(
      AttributedString(
        localized:
          "**\(bar.completed)** of \(bar.total) done today", table: "Session",
        comment:
          "At a block's end: blocks of today's session done out of all of them. Keep the ** around the first number: it shows in bold."
      ))
  }
}

/// Main's `getDayMeterParts` on the completion's blocks, so the part that fills is the block just
/// finished, wherever it sits in the day.
extension BlockMoment {
  /// A day holding time for lessons not listed yet ends in one part for them, so the meter never
  /// looks full while time is still held.
  var daySegments: [DaySegments.Segment] {
    let parts = countedBlocks.map { $0.daySegment(nextPosition: next?.block.position).mark }
    return dayProgress.lead == .open ? parts + [.ahead] : parts
  }

  var finishedSegment: Int? {
    countedBlocks.firstIndex { $0.id == blockId }
  }

  /// Core's `getSessionBar`: a skipped block is neither done nor counted.
  private var countedBlocks: [StudyBlock] {
    blocks.filter { $0.status != .skipped }
  }
}
