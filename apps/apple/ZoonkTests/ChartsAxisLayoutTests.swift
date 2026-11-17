import Charts
import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class ChartsAxisLayoutTests: XCTestCase {
  func testRenderedYearLabelsCenterOnTheirTicks() async throws {
    try await checkLabels(domain: 1958...2023, ticks: [1960, 1980, 2000, 2020])
  }

  func testRenderedNumberLineLabelsDoNotOverlap() async throws {
    try await checkLabels(domain: -7...7, ticks: (-7...7).map(Double.init))
  }

  private func checkLabels(domain: ClosedRange<Double>, ticks: [Double]) async throws {
    let probe = PlotProbe()
    let window = try show(AxisChart(domain: domain, ticks: ticks, probe: probe))
    window.frame = CGRect(x: 0, y: 0, width: 375, height: 500)
    try await Task.sleep(for: .milliseconds(600))
    let plot = probe.plot
    XCTAssertGreaterThan(plot.width, 250)
    let measurements = XCTAttachment(string: "Plot \(plot)")
    measurements.lifetime = .keepAlways
    add(measurements)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 2
    format.preferredRange = .standard
    let image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { _ in
      window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
    }
    let attachment = XCTAttachment(image: image)
    attachment.lifetime = .keepAlways
    add(attachment)
    let cgImage = try XCTUnwrap(image.cgImage)
    let data = try XCTUnwrap(cgImage.dataProvider?.data)
    let bytes = try XCTUnwrap(CFDataGetBytePtr(data))
    let positions = probe.positions
    XCTAssertEqual(positions.count, ticks.count)

    var previous: CGRect?
    for (index, x) in positions.enumerated() {
      let left = index == 0 ? plot.minX - 1 : (positions[index - 1] + x) / 2
      let right = index == positions.count - 1 ? plot.maxX + 1 : (x + positions[index + 1]) / 2
      var ink = CGRect.null
      for py in Int((plot.maxY + 3) * 2)..<Int((plot.maxY + 35) * 2) {
        for px in Int(left * 2)..<Int(right * 2) {
          let offset = py * cgImage.bytesPerRow + px * cgImage.bitsPerPixel / 8
          if bytes[offset] < 180 && bytes[offset + 1] < 180 && bytes[offset + 2] < 180 {
            ink = ink.union(CGRect(x: Double(px) / 2, y: Double(py) / 2, width: 0.5, height: 0.5))
          }
        }
      }
      XCTAssertFalse(ink.isNull, "No rendered label for \(ticks[index])")
      if index > 0 && index < ticks.count - 1 {
        XCTAssertEqual(ink.midX, x, accuracy: 1, "Rendered \(ticks[index]) at \(ink), tick \(x)")
      }
      if let previous {
        XCTAssertGreaterThanOrEqual(
          ink.minX - previous.maxX, 1, "Adjacent labels touch: \(previous), \(ink)")
      }
      previous = ink
    }
  }
}

@MainActor
private final class PlotProbe {
  var plot = CGRect.zero
  var positions: [CGFloat] = []
}

private struct AxisChart: View {
  let domain: ClosedRange<Double>
  let ticks: [Double]
  let probe: PlotProbe

  var body: some View {
    Chart {
      PointMark(x: .value("x", domain.lowerBound), y: .value("y", 0)).opacity(0)
      PointMark(x: .value("x", domain.upperBound), y: .value("y", 1)).opacity(0)
    }
    .chartXScale(domain: domain)
    .chartYAxis(.hidden)
    .chartXAxis {
      ChartsAxis.bottom(ticks: ticks, labelSpacing: 8) {
        String(Int($0))
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
    .foregroundStyle(.black)
    .frame(height: 250)
    .padding(16)
    .frame(maxHeight: .infinity, alignment: .top)
    .background(.white)
    .preferredColorScheme(.light)
  }
}
