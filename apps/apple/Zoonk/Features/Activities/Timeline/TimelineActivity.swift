import SwiftUI

extension ActivityRenderer {
  static let timeline = ActivityRenderer(
    template: "timeline", badge: .always(.placeInTime),
    grade: ActivityExpectedAnswer.grader(TimelineFields.self) { $0.expected }
  ) { context in
    if let fields = try? context.fields(as: TimelineFields.self) {
      TimelineCanvas(fields: fields, context: context)
    }
  }
}

private struct TimelineCanvas: View {
  let fields: TimelineFields
  let context: ActivityCanvasContext

  @Environment(\.legibilityWeight) private var legibilityWeight

  @ActivityState("placements") private var placements: [TimelineScale.Placement] = []
  @ActivityState("isRevealed") private var isRevealed = false

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
          ForEach(track) { item in
            eventRow(item)
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
                LessonRichText(
                  String(
                    localized: "Place \(next.label) on the timeline", table: "Activities",
                    comment: "Puts the next event on the timeline, to move to its year"))
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
          .buttonStyle(.outline)
        }
      }

      if showsTruth {
        gaps
      }
    }
  }

  private var track: [TimelineFields.TrackEvent] {
    fields.trackEvents(placements: placements, answer: context.answer, isChecked: isChecked)
  }

  private func eventRow(_ item: TimelineFields.TrackEvent) -> some View {
    let event = item.event
    let guess = item.guess
    let mark: ActivityTileMark = item.isRight.map { $0 ? .right : .wrong } ?? .plain

    return VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline) {
        LessonRichText(event.label)
          .typeWeight(.medium)
        Spacer(minLength: 8)
        if let symbol = mark.symbol {
          Image(systemName: symbol)
            .foregroundStyle(mark == .right ? Color.success : Color.destructive)
            .accessibilityHidden(true)
        }
      }

      if showsTruth {
        Group {
          if item.showsGuess {
            Text(
              "\(formatYear(event.year)). Your guess: \(formatYear(guess))",
              tableName: "Activities",
              comment: "An event's real year, then where the learner placed it")
          } else {
            Text(verbatim: formatYear(event.year))
          }
        }
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)
      } else {
        Slider(
          value: Binding(
            get: { Double(guess) },
            set: {
              move(event.id, to: TimelineScale.snapYear($0, start: fields.start, end: fields.end))
            }),
          in: Double(fields.start)...Double(fields.end), step: Double(step)
        ) {
          Text(verbatim: LessonRichText.spoken(event.label))
        } minimumValueLabel: {
          Text(formatYear(fields.start)).typeStyle(.small.monospaced())
        } maximumValueLabel: {
          Text(formatYear(fields.end)).typeStyle(.small.monospaced())
        }
        .accessibilityValue(Text(verbatim: formatYear(guess)))

        Text(formatYear(guess))
          .typeStyle(.body.weight(.semibold).monospaced())
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
    default: Color.card
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

  private var marks: [TimelineAxis.Mark] {
    let anchors = fields.anchors.map {
      TimelineAxis.Mark(label: $0.label, year: $0.year, guess: nil, kind: .anchor)
    }
    let events =
      isExploring
      ? fields.events.map {
        TimelineAxis.Mark(label: $0.label, year: $0.year, guess: nil, kind: .event)
      }
      : track.map { item in
        showsTruth
          ? TimelineAxis.Mark(
            label: item.event.label, year: item.event.year, guess: item.guess, kind: .event)
          : TimelineAxis.Mark(label: item.event.label, year: item.guess, guess: nil, kind: .guess)
      }

    return anchors + events
  }

  private var axisDescription: Text {
    let dated = marks.sorted { $0.year < $1.year }
      .map { "\(LessonRichText.spoken($0.label)): \(formatYear($0.year))" }
      .joined(separator: ". ")

    return Text(
      "A timeline from \(formatYear(fields.start)) to \(formatYear(fields.end)). \(dated).",
      tableName: "Activities", comment: "VoiceOver: a timeline's range, then each date on it")
  }

  private var gaps: some View {
    let dated =
      (fields.anchors.map { ($0.label, $0.year) } + fields.events.map { ($0.label, $0.year) })
      .sorted { $0.1 < $1.1 }

    return VStack(alignment: .leading, spacing: 6) {
      ForEach(Array(zip(dated, dated.dropFirst()).enumerated()), id: \.offset) { index, pair in
        let (earlier, later) = pair

        HStack(alignment: .firstTextBaseline, spacing: 8) {
          Circle()
            .fill(index.isMultiple(of: 2) ? Color.vizHighlight : Color.vizSecondary)
            .frame(width: 8, height: 8)
            .accessibilityHidden(true)

          gap(from: earlier, to: later, spoken: false)
            .accessibilityLabel(gap(from: earlier, to: later, spoken: true))
        }
        .typeStyle(.body)
      }
    }
  }

  private func gap(from earlier: (String, Int), to later: (String, Int), spoken: Bool) -> Text {
    let years = TimelineScale.yearsBetween(earlier.1, later.1)
    let rounded = TimelineScale.roundedGap(years)
    let from = LessonRichText.typeset(earlier.0).quoted(
      spoken: spoken, legibility: legibilityWeight)
    let to = LessonRichText.typeset(later.0).quoted(spoken: spoken, legibility: legibilityWeight)

    return Text(
      "\(gapText(years: years, rounded: rounded)) from \(from) (\(formatYear(earlier.1))) to \(to) (\(formatYear(later.1)))",
      tableName: "Activities", comment: "The time between two dates of a timeline")
  }

  private func gapText(years: Int, rounded: Int) -> Text {
    rounded == years
      ? Text(
        "\(years) years", tableName: "Activities", comment: "A number of years between two dates"
      )
      .typeWeight(.semibold, legibility: legibilityWeight)
      : Text(
        "about \(rounded) years", tableName: "Activities",
        comment: "A rounded number of years between two dates"
      )
      .typeWeight(.semibold, legibility: legibilityWeight)
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
        with: .color(Color.border), lineWidth: 2)

      // Both ends always show; a tick between them shows only where its year fits beside the
      // others, so a narrow axis (a phone, a pane of the open iPhone Duo) never overlaps them.
      let ticks = TimelineScale.ticks(start: fields.start, end: fields.end).map { tick in
        let label = context.resolve(
          Text(formatYear(tick)).font(TypeStyle.small.monospaced().font(in: context.environment))
            .foregroundStyle(.mutedForeground))
        let anchor: UnitPoint =
          x(tick) < size.width * 0.15
          ? .topLeading : x(tick) > size.width * 0.85 ? .topTrailing : .top
        let labelWidth = label.measure(in: size).width
        let minX = x(tick) - labelWidth * anchor.x
        return (label: label, tick: tick, anchor: anchor, span: minX...(minX + labelWidth + 8))
      }
      var shown = [ticks.first, ticks.count > 1 ? ticks.last : nil].compactMap { $0 }

      for tick in ticks.dropFirst().dropLast()
      where !shown.contains(where: { $0.span.overlaps(tick.span) }) {
        shown.append(tick)
      }

      for tick in shown {
        context.draw(tick.label, at: CGPoint(x: x(tick.tick), y: 0), anchor: tick.anchor)
      }

      for (index, mark) in sorted.enumerated() {
        let y = axisY + rowHeight * Double(index + 1)
        let color: Color =
          mark.kind == .anchor ? .mutedForeground : mark.kind == .guess ? .primary : .success

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
          Text(
            LessonRichText.typeset(mark.label).text,
            legibility: context.environment.legibilityWeight
          )
          .font(TypeStyle.meta.font(in: context.environment)).foregroundStyle(
            color == .mutedForeground ? .mutedForeground : .primary),
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
