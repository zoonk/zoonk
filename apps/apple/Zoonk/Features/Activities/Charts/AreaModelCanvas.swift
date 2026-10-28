import SwiftUI

struct AreaModelFields: Decodable, Hashable, Sendable {
  struct Side: Decodable, Hashable, Sendable {
    let label: String?
    let parts: [Double]
    let total: Double
  }

  let model: String
  let width: Side?
  let height: Side?
  let bar: Side?
  let unit: String?

  var isArea: Bool { model == "area" }

  var sides: [Side] {
    isArea ? [width, height].compactMap { $0 } : [bar].compactMap { $0 }
  }
}

/// Main's `area-model-cuts.ts`: split lines on a side and the parts between them.
struct AreaModelSide: Hashable {
  var cuts: [Double]
  let step: Double
  let total: Double

  init(_ side: AreaModelFields.Side) {
    cuts = side.parts.dropLast().reduce(into: []) { cuts, part in
      cuts.append((cuts.last ?? 0) + part)
    }
    step =
      [1, 0.5, 0.25, 0.1, 0.05, 0.01].first { step in
        side.parts.allSatisfy { ChartsMath.isMultiple($0, of: step) }
      } ?? 0.01
    total = side.total
  }

  var parts: [Double] {
    let edges = [0] + cuts + [total]
    return zip(edges.dropFirst(), edges).map { ChartsMath.clean($0 - $1) }
  }

  /// Moves one split line, at least a step away from its neighbors and the edges, so a part can
  /// shrink to one step but never vanish or swap places with the next.
  func moving(_ index: Int, to value: Double) -> AreaModelSide {
    let low = (index > 0 ? cuts[index - 1] : 0) + step
    let high = (index + 1 < cuts.count ? cuts[index + 1] : total) - step

    guard low <= high else {
      return self
    }

    var next = self
    next.cuts[index] = ChartsMath.snap(value, min: low, max: high, step: step)
    return next
  }
}

/// Splits a rectangle (or a bar) into easy parts by dragging split lines, with each part's size
/// worked out live (main's `AreaModelActivity`). The parts always add up to the same total, which
/// is the idea. The canvas never answers a numeric check: the learner adds the parts and types it.
struct AreaModelCanvas: View {
  let context: ActivityCanvasContext
  let fields: AreaModelFields

  @State private var sides: [AreaModelSide]
  @State private var width: CGFloat = 320
  private let format = ChartsNumberFormat()

  init(context: ActivityCanvasContext, fields: AreaModelFields) {
    self.context = context
    self.fields = fields
    _sides = State(initialValue: fields.sides.map(AreaModelSide.init))
  }

  private var isChecked: Bool {
    if case .checked = context.phase { return true }
    return false
  }

  /// Each cell's product (area model) or each part (bar model), row by row.
  private var pieces: [Double] {
    guard let first = sides.first else {
      return []
    }

    guard sides.count > 1 else {
      return first.parts
    }

    return sides[1].parts.flatMap { height in first.parts.map { $0 * height } }
  }

  private var unit: String? {
    fields.isArea ? fields.unit.map { "\($0)²" } : fields.unit
  }

  private var hidesTotal: Bool {
    if case .numeric = context.check, !isChecked { return true }
    return false
  }

  var body: some View {
    let total = pieces.reduce(0, +)
    let sum =
      "\(pieces.map { format($0) }.joined(separator: " + ")) = \(hidesTotal ? "?" : format(total, unit: unit))"

    ChartsCanvas {
      if fields.isArea {
        AreaGrid(sides: $sides, isEnabled: !isChecked, format: format)
          .frame(height: gridHeight)
          .frame(maxWidth: .infinity)
          .onGeometryChange(for: CGFloat.self) {
            $0.size.width
          } action: {
            width = $0
          }
      } else {
        AreaBar(sides: $sides, isEnabled: !isChecked, format: format)
      }

      ChartsReadout(text: sum)
        .accessibilityHidden(true)
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(Text(verbatim: summary(total: total)))
  }

  /// The rectangle keeps its proportions within a readable height.
  private var gridHeight: CGFloat {
    guard sides.count > 1, sides[0].total > 0 else {
      return 180
    }

    let drawn = (width - 48) * sides[1].total / sides[0].total
    return min(max(drawn, 140), 260) + 32
  }

  private func summary(total: Double) -> String {
    let parts = String(
      localized:
        "Split into \(pieces.count) parts: \(pieces.map { format($0) }.joined(separator: ", ")).",
      table: "ActivitiesCharts", comment: "An area or bar model's parts, for VoiceOver")

    guard !hidesTotal else {
      return parts
    }

    let together = String(
      localized: "Together they make \(format(total, unit: unit)).", table: "ActivitiesCharts",
      comment: "An area or bar model's total, for VoiceOver")

    return "\(parts) \(together)"
  }
}

/// A rectangle split across its width and height, each cell labelled with its product.
private struct AreaGrid: View {
  @Binding var sides: [AreaModelSide]
  let isEnabled: Bool
  let format: ChartsNumberFormat

  var body: some View {
    GeometryReader { geometry in
      let inset = EdgeInsets(top: 28, leading: 40, bottom: 4, trailing: 8)
      let frame = CGRect(
        x: inset.leading, y: inset.top, width: geometry.size.width - inset.leading - inset.trailing,
        height: geometry.size.height - inset.top - inset.bottom)
      let width = sides[0]
      let height = sides[1]
      let xs = edges(width).map { frame.minX + frame.width * $0 / width.total }
      let ys = edges(height).map { frame.minY + frame.height * $0 / height.total }

      ZStack(alignment: .topLeading) {
        ForEach(Array(height.parts.enumerated()), id: \.offset) { row, rowPart in
          ForEach(Array(width.parts.enumerated()), id: \.offset) { column, columnPart in
            let cell = CGRect(
              x: xs[column], y: ys[row], width: xs[column + 1] - xs[column],
              height: ys[row + 1] - ys[row])

            Rectangle()
              .fill(Color.mint.opacity((row + column).isMultiple(of: 2) ? 0.18 : 0.3))
              .overlay { Rectangle().strokeBorder(Color.mint, lineWidth: 1) }
              .overlay {
                Text(verbatim: format(columnPart * rowPart))
                  .font(.caption.weight(.semibold).monospacedDigit())
                  .minimumScaleFactor(0.5)
                  .lineLimit(1)
                  .padding(2)
              }
              .frame(width: cell.width, height: cell.height)
              .position(x: cell.midX, y: cell.midY)
          }
        }

        ForEach(Array(width.parts.enumerated()), id: \.offset) { index, part in
          Text(verbatim: format(part))
            .font(.caption.monospacedDigit())
            .foregroundStyle(.secondary)
            .position(x: (xs[index] + xs[index + 1]) / 2, y: frame.minY - 14)
        }

        ForEach(Array(height.parts.enumerated()), id: \.offset) { index, part in
          Text(verbatim: format(part))
            .font(.caption.monospacedDigit())
            .foregroundStyle(.secondary)
            .position(x: frame.minX - 20, y: (ys[index] + ys[index + 1]) / 2)
        }

        ForEach(width.cuts.indices, id: \.self) { index in
          SplitHandle(
            label: Text(
              "Split across the width", tableName: "ActivitiesCharts",
              comment: "A split line across an area model's width"),
            value: format(width.cuts[index]), isEnabled: isEnabled
          ) { steps in
            sides[0] = width.moving(index, to: width.cuts[index] + Double(steps) * width.step)
          } drag: { location in
            sides[0] = width.moving(
              index, to: (location.x - frame.minX) / frame.width * width.total)
          }
          .position(x: xs[index + 1], y: frame.minY)
        }

        ForEach(height.cuts.indices, id: \.self) { index in
          SplitHandle(
            label: Text(
              "Split across the height", tableName: "ActivitiesCharts",
              comment: "A split line across an area model's height"),
            value: format(height.cuts[index]), isEnabled: isEnabled
          ) { steps in
            sides[1] = height.moving(index, to: height.cuts[index] + Double(steps) * height.step)
          } drag: { location in
            sides[1] = height.moving(
              index, to: (location.y - frame.minY) / frame.height * height.total)
          }
          .position(x: frame.minX, y: ys[index + 1])
        }
      }
      .coordinateSpace(.named(ChartsPlot.space))
    }
  }
}

/// A bar split into parts, its total over it.
private struct AreaBar: View {
  @Binding var sides: [AreaModelSide]
  let isEnabled: Bool
  let format: ChartsNumberFormat

  var body: some View {
    GeometryReader { geometry in
      let bar = sides[0]
      let frame = CGRect(
        x: 8, y: 32, width: geometry.size.width - 16, height: geometry.size.height - 40)
      let xs = edges(bar).map { frame.minX + frame.width * $0 / bar.total }

      ZStack(alignment: .topLeading) {
        Text(verbatim: format(bar.total))
          .font(.caption.weight(.medium).monospacedDigit())
          .foregroundStyle(.secondary)
          .position(x: frame.midX, y: frame.minY - 16)

        ForEach(Array(bar.parts.enumerated()), id: \.offset) { index, part in
          Rectangle()
            .fill(Color.mint.opacity(index.isMultiple(of: 2) ? 0.18 : 0.3))
            .overlay { Rectangle().strokeBorder(Color.mint, lineWidth: 1) }
            .overlay {
              Text(verbatim: format(part))
                .font(.caption.weight(.semibold).monospacedDigit())
                .minimumScaleFactor(0.5)
                .lineLimit(1)
            }
            .frame(width: xs[index + 1] - xs[index], height: frame.height)
            .position(x: (xs[index] + xs[index + 1]) / 2, y: frame.midY)
        }

        ForEach(bar.cuts.indices, id: \.self) { index in
          SplitHandle(
            label: Text(
              "Split across the width", tableName: "ActivitiesCharts",
              comment: "A split line across an area model's width"),
            value: format(bar.cuts[index]), isEnabled: isEnabled
          ) { steps in
            sides[0] = bar.moving(index, to: bar.cuts[index] + Double(steps) * bar.step)
          } drag: { location in
            sides[0] = bar.moving(index, to: (location.x - frame.minX) / frame.width * bar.total)
          }
          .position(x: xs[index + 1], y: frame.minY)
        }
      }
      .coordinateSpace(.named(ChartsPlot.space))
    }
    .frame(height: 96)
  }
}

private func edges(_ side: AreaModelSide) -> [Double] {
  [0] + side.cuts + [side.total]
}

/// A split line's handle: dragged by touch, adjusted by VoiceOver and the arrow keys.
private struct SplitHandle: View {
  let label: Text
  let value: String
  let isEnabled: Bool
  let move: (Int) -> Void
  let drag: (CGPoint) -> Void

  var body: some View {
    ChartsHandle(isEnabled: isEnabled)
      .chartsAdjustable(label: label, value: value, isEnabled: isEnabled, move: move)
      .gesture(
        DragGesture(minimumDistance: 0, coordinateSpace: .named(ChartsPlot.space))
          .onChanged { drag($0.location) },
        isEnabled: isEnabled)
  }
}
