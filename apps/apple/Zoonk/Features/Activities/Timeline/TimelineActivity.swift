import SwiftUI

extension ActivityRenderer {
  static let timeline = ActivityRenderer(
    template: "timeline",
    grade: ActivityExpectedAnswer.grader(TimelineFields.self) { $0.expected }
  ) { context in
    if let fields = try? context.fields(as: TimelineFields.self) {
      TimelineCanvas(fields: fields, context: context)
    }
  }
}

/// Events placed on a true-to-scale axis, to feel how far apart they are. The learner places each
/// event, then slides it to the year they think (VoiceOver adjusts the slider; arrows move it on a
/// keyboard). Afterwards the real dates show next to the guesses, with the years between known
/// dates. With an order check the placed order is the answer; with a question the learner reveals
/// the real dates first. Explored, every event shows at its real date.
private struct TimelineCanvas: View {
  let fields: TimelineFields
  let context: ActivityCanvasContext

  @State private var placements: [TimelineScale.Placement] = []
  @State private var isRevealed = false

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  private var isExploring: Bool { context.phase == .explore }
  private var showsTruth: Bool { isRevealed || isChecked || isExploring }
  private var step: Int { TimelineScale.yearStep(start: fields.start, end: fields.end) }

  var body: some View {
    let unplaced = fields.events.filter { event in !placements.contains { $0.id == event.id } }

    VStack(alignment: .leading, spacing: 16) {
      TimelineAxis(fields: fields, marks: marks, formatYear: formatYear)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(axisDescription)

      if !isExploring {
        VStack(spacing: 8) {
          ForEach(fields.events.filter { event in placements.contains { $0.id == event.id } }) {
            event in
            eventRow(event)
          }
        }

        if !isChecked, let next = unplaced.first {
          VStack(alignment: .leading, spacing: 8) {
            ActivityCaption(
              Text(
                "\(unplaced.count) events to place", tableName: "Activities",
                comment: "How many events of a timeline are left to place"))

            Button {
              placements.append(
                TimelineScale.Placement(
                  id: next.id,
                  year: TimelineScale.snapYear(
                    Double(fields.start + fields.end) / 2, start: fields.start, end: fields.end)))
              report()
            } label: {
              Label {
                Text(
                  "Place \(next.label) on the timeline", tableName: "Activities",
                  comment: "Puts the next event on the timeline, to move to its year")
              } icon: {
                Image(systemName: "plus")
              }
              .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(ActivityTileStyle(mark: .plain))
          }
        }

        if case .choice = context.check, !showsTruth, unplaced.isEmpty {
          Button {
            isRevealed = true
          } label: {
            Text(
              "Show the real dates", tableName: "Activities",
              comment: "Reveals the real years on a timeline")
          }
          .buttonStyle(.bordered)
        }
      }

      if showsTruth {
        gaps
      }
    }
  }

  // MARK: - Events

  private func eventRow(_ event: TimelineFields.Event) -> some View {
    let year = placements.first { $0.id == event.id }?.year ?? event.year
    let order = TimelineScale.placedOrder(placements)
    let expected = fields.events.sorted { $0.year < $1.year }.map(\.id)
    let mark: ActivityTileMark =
      isChecked
      ? (order.firstIndex(of: event.id) == expected.firstIndex(of: event.id) ? .right : .wrong)
      : .plain

    return VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline) {
        LessonRichText(event.label)
          .fontWeight(.medium)
        Spacer(minLength: 8)
        if let symbol = mark.symbol {
          Image(systemName: symbol)
            .foregroundStyle(mark == .right ? Color.success : Color.destructive)
            .accessibilityHidden(true)
        }
      }

      if showsTruth {
        Text(
          "\(formatYear(event.year)). Your guess: \(formatYear(year))", tableName: "Activities",
          comment: "An event's real year, then where the learner placed it"
        )
        .font(.subheadline.monospacedDigit())
        .foregroundStyle(.secondary)
      } else {
        Slider(
          value: Binding(
            get: { Double(year) },
            set: {
              move(event.id, to: TimelineScale.snapYear($0, start: fields.start, end: fields.end))
            }),
          in: Double(fields.start)...Double(fields.end), step: Double(step)
        ) {
          Text(LessonRichText.attributed(event.label))
        } minimumValueLabel: {
          Text(formatYear(fields.start)).font(.caption2.monospacedDigit())
        } maximumValueLabel: {
          Text(formatYear(fields.end)).font(.caption2.monospacedDigit())
        }
        .accessibilityValue(Text(verbatim: formatYear(year)))

        Text(formatYear(year))
          .font(.subheadline.weight(.semibold).monospacedDigit())
          .accessibilityHidden(true)
      }
    }
    .padding(12)
    .background(background(mark), in: .rect(cornerRadius: 12))
    .accessibilityElement(children: showsTruth ? .combine : .contain)
  }

  private func background(_ mark: ActivityTileMark) -> Color {
    switch mark {
    case .right: Color.success.opacity(0.1)
    case .wrong: Color.destructive.opacity(0.1)
    default: Color(.secondarySystemBackground)
    }
  }

  private func move(_ id: String, to year: Int) {
    guard !showsTruth, let index = placements.firstIndex(where: { $0.id == id }) else {
      return
    }

    placements[index].year = year
    report()
  }

  private func report() {
    guard case .interaction = context.check else {
      return
    }

    context.setAnswer(
      placements.count == fields.events.count ? .order(TimelineScale.placedOrder(placements)) : nil)
  }

  // MARK: - The axis

  /// What the axis draws: the anchors, and each placed event at its guess (with its real year once
  /// shown); explored, every event at its real year.
  private var marks: [TimelineAxis.Mark] {
    let anchors = fields.anchors.map {
      TimelineAxis.Mark(label: $0.label, year: $0.year, guess: nil, kind: .anchor)
    }
    let events = fields.events.compactMap { event -> TimelineAxis.Mark? in
      if isExploring {
        return TimelineAxis.Mark(label: event.label, year: event.year, guess: nil, kind: .event)
      }

      guard
        let guess = placements.first(where: { $0.id == event.id })?.year
          ?? (isChecked ? event.year : nil)
      else {
        return nil
      }

      return showsTruth
        ? TimelineAxis.Mark(label: event.label, year: event.year, guess: guess, kind: .event)
        : TimelineAxis.Mark(label: event.label, year: guess, guess: nil, kind: .guess)
    }

    return anchors + events
  }

  private var axisDescription: Text {
    let dated = marks.sorted { $0.year < $1.year }
      .map { "\(LessonRichText.plain($0.label)): \(formatYear($0.year))" }
      .joined(separator: ". ")

    return Text(
      "A timeline from \(formatYear(fields.start)) to \(formatYear(fields.end)). \(dated).",
      tableName: "Activities", comment: "VoiceOver: a timeline's range, then each date on it")
  }

  /// How far apart neighboring dates really are, once the real dates show.
  private var gaps: some View {
    let dated =
      (fields.anchors.map { ($0.label, $0.year) } + fields.events.map { ($0.label, $0.year) })
      .sorted { $0.1 < $1.1 }

    return VStack(alignment: .leading, spacing: 6) {
      ForEach(Array(zip(dated, dated.dropFirst()).enumerated()), id: \.offset) { index, pair in
        let (earlier, later) = pair
        let years = TimelineScale.yearsBetween(earlier.1, later.1)
        let rounded = TimelineScale.roundedGap(years)

        HStack(alignment: .firstTextBaseline, spacing: 8) {
          Circle()
            .fill(index.isMultiple(of: 2) ? Color.orange : Color.purple)
            .frame(width: 8, height: 8)
            .accessibilityHidden(true)

          Text(
            "\(gapText(years: years, rounded: rounded)) from \(LessonRichText.plain(earlier.0)) (\(formatYear(earlier.1))) to \(LessonRichText.plain(later.0)) (\(formatYear(later.1)))",
            tableName: "Activities", comment: "The time between two dates of a timeline")
        }
        .font(.subheadline)
      }
    }
  }

  private func gapText(years: Int, rounded: Int) -> Text {
    rounded == years
      ? Text(
        "\(years) years", tableName: "Activities", comment: "A number of years between two dates"
      )
      .fontWeight(.semibold)
      : Text(
        "about \(rounded) years", tableName: "Activities",
        comment: "A rounded number of years between two dates"
      )
      .fontWeight(.semibold)
  }

  private func formatYear(_ year: Int) -> String {
    let (era, value) = TimelineScale.era(of: year, start: fields.start)
    let number = value.formatted(.number.grouping(.never))

    switch era {
    case .bce:
      return String(
        localized: "\(number) BCE", table: "Activities", comment: "A year before the common era")
    case .ce:
      return String(
        localized: "\(number) CE", table: "Activities", comment: "A year of the common era")
    case .none:
      return number
    }
  }
}

/// The true-to-scale axis: round year ticks, the anchors as dots, events at their years (hollow
/// while guessed; once the real dates show, a line from the guess to the real year).
private struct TimelineAxis: View {
  struct Mark: Hashable {
    enum Kind {
      case anchor, guess, event
    }

    let label: String
    let year: Int
    let guess: Int?
    let kind: Kind
  }

  let fields: TimelineFields
  let marks: [Mark]
  let formatYear: (Int) -> String

  @ScaledMetric(relativeTo: .caption) private var rowHeight = 22.0

  var body: some View {
    let sorted = marks.sorted { $0.year < $1.year }

    Canvas { context, size in
      let inset = 12.0
      let width = size.width - inset * 2
      let axisY = rowHeight + 4
      let x = { (year: Int) in
        inset + width * Double(year - fields.start) / Double(max(fields.end - fields.start, 1))
      }

      context.stroke(
        Path {
          $0.move(to: CGPoint(x: inset, y: axisY))
          $0.addLine(to: CGPoint(x: inset + width, y: axisY))
        },
        with: .color(Color(.separator)), lineWidth: 2)

      for tick in TimelineScale.ticks(start: fields.start, end: fields.end) {
        context.draw(
          Text(formatYear(tick)).font(.caption2.monospacedDigit()).foregroundStyle(.secondary),
          at: CGPoint(x: x(tick), y: 0),
          anchor: x(tick) < size.width * 0.15
            ? .topLeading : x(tick) > size.width * 0.85 ? .topTrailing : .top)
      }

      for (index, mark) in sorted.enumerated() {
        let y = axisY + rowHeight * Double(index + 1)
        let color: Color =
          mark.kind == .anchor ? .secondary : mark.kind == .guess ? .primary : .success

        if let guess = mark.guess, guess != mark.year {
          context.stroke(
            Path {
              $0.move(to: CGPoint(x: x(guess), y: axisY))
              $0.addLine(to: CGPoint(x: x(mark.year), y: axisY))
            },
            with: .color(Color.destructive.opacity(0.5)), lineWidth: 4)
          dot(context, at: CGPoint(x: x(guess), y: axisY), color: .primary, filled: false)
        }

        dot(
          context, at: CGPoint(x: x(mark.year), y: axisY), color: color, filled: mark.kind != .guess
        )
        context.stroke(
          Path {
            $0.move(to: CGPoint(x: x(mark.year), y: axisY + 5))
            $0.addLine(to: CGPoint(x: x(mark.year), y: y - 8))
          },
          with: .color(color.opacity(0.4)), lineWidth: 1)

        let anchor: UnitPoint =
          x(mark.year) < size.width / 3
          ? .leading : x(mark.year) > size.width * 2 / 3 ? .trailing : .center
        context.draw(
          Text(LessonRichText.plain(mark.label)).font(.caption).foregroundStyle(
            color == .secondary ? .secondary : .primary),
          at: CGPoint(x: x(mark.year), y: y), anchor: anchor)
      }
    }
    .frame(height: rowHeight + 4 + rowHeight * Double(marks.count + 1) + 4)
  }

  private func dot(_ context: GraphicsContext, at point: CGPoint, color: Color, filled: Bool) {
    let rect = CGRect(x: point.x - 5, y: point.y - 5, width: 10, height: 10)

    if filled {
      context.fill(Path(ellipseIn: rect), with: .color(color))
    } else {
      context.stroke(Path(ellipseIn: rect), with: .color(color), lineWidth: 2)
    }
  }
}
