import Charts
import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class ChartsAxisLayoutTests: XCTestCase {
  func testRenderedYearLabelsStayInsideTheirPlotAndClearTheYAxis() async throws {
    try await checkChart(domain: 1960...2020, ticks: [1960, 1980, 2000, 2020])
  }

  func testRenderedPercentageEndsStayInsideTheirPlot() async throws {
    try await checkChart(domain: 0...12, ticks: [0, 12], isPercent: true)
  }

  func testRenderedNumberLineLabelsDoNotOverlap() async throws {
    let probe = PlotProbe()
    let fields = NumberLineFields(
      label: "Temperature", min: -5, max: 7,
      moves: [.init(by: 3, label: nil), .init(by: 5, label: nil)],
      start: -3, step: 1, unit: "°C")
    let window = try show(
      panel(probe: probe) {
        NumberLineCanvas(
          context: ActivityCanvasContext(
            template: "numberLine", payload: .null, check: nil, phase: .answering,
            answer: nil, setAnswer: { _ in }), fields: fields)
      }.environment(ActivityWork()).dynamicTypeSize(.large))
    window.frame = CGRect(x: 0, y: 0, width: 375, height: 500)
    try await Task.sleep(for: .milliseconds(600))
    let raster = try Raster(window: window)
    attach(raster.image)
    // Read the real rule and its endpoint ticks; the handle can cover an inner tick.
    let line = try XCTUnwrap(
      (0..<raster.height).map { y -> CGRect? in
        let ink = raster.ink(in: CGRect(x: 0, y: CGFloat(y), width: raster.width, height: 0.5))
        return ink.width > 280 && raster.darkCount(y: y) > 500 ? ink : nil
      }.compactMap { $0 }.first)
    let tickCenters = raster.tickCenters(
      in: CGRect(x: 0, y: line.minY + 3, width: raster.width, height: 10))
    let first = try XCTUnwrap(tickCenters.first)
    let last = try XCTUnwrap(tickCenters.last)
    XCTAssertGreaterThan(last - first, 280)
    let plot = CGRect(x: first, y: line.minY - 100, width: last - first, height: 100)
    let positions = fields.ticks.map {
      plot.minX + CGFloat(($0.value - fields.min) / (fields.max - fields.min)) * plot.width
    }
    let labels = raster.labels(in: CGRect(x: 0, y: plot.maxY + 7, width: raster.width, height: 28))
    XCTAssertEqual(labels.count, fields.ticks.count, "Every number must remain separately readable")
    let ordinaryGaps = zip(labels.dropFirst().dropLast(2), labels.dropFirst(2).dropLast())
      .map { $1.minX - $0.maxX }
    let halfFontSize = TypeStyle.body.uiFont(.large, legibility: nil).pointSize / 2
    check(
      raster, plot: plot, panel: probe.panel, positions: positions, checksCorner: false,
      labels: labels, anchorsEnds: false,
      minimumGap: max(halfFontSize, ordinaryGaps.min() ?? 0))
  }

  private func checkChart(domain: ClosedRange<Double>, ticks: [Double], isPercent: Bool = false)
    async throws
  {
    let probe = PlotProbe()
    let window = try show(
      panel(probe: probe) {
        AxisChart(domain: domain, ticks: ticks, probe: probe, isPercent: isPercent)
          .frame(height: 250)
      })
    window.frame = CGRect(x: 0, y: 0, width: 375, height: 500)
    try await Task.sleep(for: .milliseconds(600))
    let raster = try Raster(window: window)
    attach(raster.image)
    XCTAssertGreaterThan(probe.plot.width, 200)
    XCTAssertEqual(probe.positions.count, ticks.count)
    check(
      raster, plot: probe.plot, panel: probe.panel, positions: probe.positions, checksCorner: true)
  }

  private func panel<Content: View>(probe: PlotProbe, @ViewBuilder content: () -> Content)
    -> some View
  {
    content()
      .foregroundStyle(.black)
      .activityPanel()
      .onGeometryChange(for: CGRect.self) {
        $0.frame(in: .global)
      } action: {
        probe.panel = $0
      }
      .padding(16)
      .frame(maxHeight: .infinity, alignment: .top)
      .background(.white)
      .preferredColorScheme(.light)
  }

  private func check(
    _ raster: Raster, plot: CGRect, panel: CGRect, positions: [CGFloat], checksCorner: Bool,
    labels: [CGRect]? = nil, anchorsEnds: Bool = true, minimumGap: CGFloat = 1
  ) {
    var previous: CGRect?
    for (index, x) in positions.enumerated() {
      let left = index == 0 ? 0 : (positions[index - 1] + x) / 2
      let right = index == positions.count - 1 ? raster.width : (x + positions[index + 1]) / 2
      let ink =
        labels.flatMap { $0.indices.contains(index) ? $0[index] : nil }
        ?? raster.ink(in: CGRect(x: left, y: plot.maxY + 7, width: right - left, height: 28))
      XCTAssertFalse(ink.isNull, "Missing rendered label at \(x), plot \(plot)")
      XCTAssertTrue(
        panel.insetBy(dx: -0.5, dy: -0.5).contains(ink), "Label \(ink) outside panel \(panel)")
      if anchorsEnds {
        XCTAssertGreaterThanOrEqual(
          ink.minX, plot.minX - 0.5, "Label \(ink) spills before plot \(plot)")
        XCTAssertLessThanOrEqual(
          ink.maxX, plot.maxX + 0.5, "Label \(ink) spills after plot \(plot)")
      }
      if !anchorsEnds || (index > 0 && index < positions.count - 1) {
        XCTAssertEqual(ink.midX, x, accuracy: 1, "Label \(ink) off tick \(x)")
      }
      if let previous { XCTAssertGreaterThanOrEqual(ink.minX - previous.maxX, minimumGap) }
      if checksCorner && index == 0 {
        let yLabel = raster.ink(
          in: CGRect(x: 0, y: plot.maxY - 12, width: plot.minX - 2, height: 18))
        XCTAssertFalse(yLabel.isNull, "The y axis must be shown")
        XCTAssertGreaterThanOrEqual(
          ink.minX - yLabel.maxX, 4, "Corner labels stack: \(yLabel), \(ink)")
      }
      previous = ink
    }
  }

  private func attach(_ image: UIImage) {
    let attachment = XCTAttachment(image: image)
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}

@MainActor
private final class PlotProbe {
  var panel = CGRect.zero
  var plot = CGRect.zero
  var positions: [CGFloat] = []
}

private struct AxisChart: View {
  let domain: ClosedRange<Double>
  let ticks: [Double]
  let probe: PlotProbe
  let isPercent: Bool

  var body: some View {
    Chart {
      PointMark(x: .value("x", domain.lowerBound), y: .value("y", isPercent ? 0 : 300)).opacity(0)
      PointMark(x: .value("x", domain.upperBound), y: .value("y", isPercent ? 10000 : 400)).opacity(
        0)
    }
    .chartXScale(domain: domain)
    .chartYScale(domain: isPercent ? 0...10000 : 300...400)
    .chartYAxis {
      ChartsAxis.values(ticks: isPercent ? [0, 5000, 10000] : [300, 350, 400]) {
        isPercent ? "$\(Int($0))" : String(Int($0))
      }
    }
    .chartsXAxis {
      ChartsAxis.bottom(ticks: ticks, labelSpacing: 8) {
        isPercent ? "\(Int($0))%" : String(Int($0))
      }
    }
    .chartOverlay { proxy in
      GeometryReader { geometry in
        Color.clear.onAppear {
          if let anchor = proxy.plotFrame {
            let origin = geometry.frame(in: .global).origin
            probe.plot = geometry[anchor].offsetBy(dx: origin.x, dy: origin.y)
            probe.positions = ticks.compactMap { tick in
              proxy.position(forX: tick).map { probe.plot.minX + $0 }
            }
          }
        }
      }
    }
  }
}

private struct Raster {
  let image: UIImage
  let cgImage: CGImage
  let data: CFData
  var width: CGFloat { CGFloat(cgImage.width) / 2 }
  var height: Int { cgImage.height / 2 }

  @MainActor init(window: UIWindow) throws {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 2
    format.preferredRange = .standard
    image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { _ in
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
    }
    cgImage = try XCTUnwrap(image.cgImage)
    data = try XCTUnwrap(cgImage.dataProvider?.data)
  }

  func tickCenters(in rect: CGRect) -> [CGFloat] {
    let bytes = CFDataGetBytePtr(data)!
    var groups: [[Int]] = []
    for x in 0..<cgImage.width {
      let hasGrid = (Int(rect.minY * 2)..<Int(rect.maxY * 2)).contains { y in
        let offset = y * cgImage.bytesPerRow + x * cgImage.bitsPerPixel / 8
        let rgb = [Int(bytes[offset]), Int(bytes[offset + 1]), Int(bytes[offset + 2])]
        return rgb.allSatisfy { (200...244).contains($0) } && rgb.max()! - rgb.min()! < 3
      }
      if hasGrid {
        if groups.last?.last == x - 1 {
          groups[groups.count - 1].append(x)
        } else {
          groups.append([x])
        }
      }
    }
    return groups.map { CGFloat($0.first! + $0.last! + 1) / 4 }
  }

  func labels(in rect: CGRect) -> [CGRect] {
    var labels: [CGRect] = []
    for x in 0..<cgImage.width {
      let column = ink(in: CGRect(x: CGFloat(x) / 2, y: rect.minY, width: 0.5, height: rect.height))
      guard !column.isNull else { continue }
      if let last = labels.last, column.minX - last.maxX < 2 {
        labels[labels.count - 1] = last.union(column)
      } else {
        labels.append(column)
      }
    }
    return labels
  }

  func darkCount(y: Int) -> Int {
    (0..<cgImage.width).filter { dark(x: $0, y: y * 2) }.count
  }

  func ink(in rect: CGRect) -> CGRect {
    var ink = CGRect.null
    for y in max(0, Int(rect.minY * 2))..<min(cgImage.height, Int(rect.maxY * 2)) {
      for x in max(0, Int(rect.minX * 2))..<min(cgImage.width, Int(rect.maxX * 2))
      where dark(x: x, y: y) {
        ink = ink.union(CGRect(x: Double(x) / 2, y: Double(y) / 2, width: 0.5, height: 0.5))
      }
    }
    return ink
  }

  private func dark(x: Int, y: Int) -> Bool {
    let bytes = CFDataGetBytePtr(data)!
    let offset = y * cgImage.bytesPerRow + x * cgImage.bitsPerPixel / 8
    return bytes[offset] < 180 && bytes[offset + 1] < 180 && bytes[offset + 2] < 180
  }
}
