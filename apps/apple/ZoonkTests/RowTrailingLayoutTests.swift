import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class RowTrailingLayoutTests: XCTestCase {
  func testMixedRowsKeepOneValueEdge() async throws {
    let probes = Probes()
    let window = try show(
      NavigationStack {
        ZoonkList {
          Section {
            ListRow(Text(verbatim: "Phase")) {
            } trailing: {
              Text(verbatim: "16 Feb").background(Probe(id: "plain", probes: probes))
            }
            NavigationLink {
              Text(verbatim: "Destination")
            } label: {
              ListRow(Text(verbatim: "Chapter")) {
              } trailing: {
                Text(verbatim: "16 Feb").background(Probe(id: "link", probes: probes))
              }
            }
          }
        }
      }
      .environment(\.horizontalSizeClass, .compact)
      .zoonkStyles()
    )
    for _ in 0..<30 {
      window.layoutIfNeeded()
      if probes.views.count == 2, probes.views.values.allSatisfy({ $0.window != nil }) { break }
      try await Task.sleep(for: .milliseconds(50))
    }
    let plain = try XCTUnwrap(probes.views["plain"])
    let link = try XCTUnwrap(probes.views["link"])
    try await settle(window)
    XCTAssertEqual(
      plain.convert(plain.bounds, to: window).maxX,
      link.convert(link.bounds, to: window).maxX, accuracy: 0.5)
  }

  func testMixedCustomDisclosuresKeepOneValueEdge() async throws {
    try await check(kind: .custom)
  }

  func testMixedDisclosureGroupsKeepOneValueEdge() async throws {
    try await check(kind: .group)
  }

  func testChevronFreePageSectionsKeepTheirFullWidth() async throws {
    let probes = Probes()
    let window = try show(
      NavigationStack {
        ZoonkList {
          PageSection {
            row("alone", probes: probes)
          } header: {
            EmptyView()
          }
          PageSection {
            row("mixed", probes: probes)
            row("custom", probes: probes).disclosureChevron()
          } header: {
            EmptyView()
          }
        }
      }.environment(\.horizontalSizeClass, .compact).zoonkStyles())
    try await settle(window)
    let alone = try edge("alone", probes: probes, window: window)
    let mixed = try edge("mixed", probes: probes, window: window)
    let custom = try edge("custom", probes: probes, window: window)
    XCTAssertEqual(mixed, custom, accuracy: 0.5)
    XCTAssertGreaterThan(alone, mixed + 10)
  }

  func testRightToLeftRowsKeepOneValueEdge() async throws {
    try await check(kind: .custom, direction: .rightToLeft)
  }

  func testIconLabeledContentUsesTheSameTrailingColumn() async throws {
    let probes = Probes()
    let window = try show(
      ZoonkList {
        Section {
          IconLabeledContent {
            Text(verbatim: "16 Feb").background(Probe(id: "plain", probes: probes))
          } title: {
            Text(verbatim: "Date")
          } icon: {
            Image(systemName: "calendar")
          }
          row("custom", probes: probes).disclosureChevron()
        }
      }.environment(\.horizontalSizeClass, .compact).zoonkStyles())
    try await settle(window)
    XCTAssertEqual(
      try edge("plain", probes: probes, window: window),
      try edge("custom", probes: probes, window: window), accuracy: 0.5)
  }

  func testASectionWithoutChevronsAddsNoSpace() async throws {
    let probes = Probes()
    let window = try show(
      ZoonkList {
        Section {
          row("value", probes: probes).background(Probe(id: "row", probes: probes))
        }
      }.environment(\.horizontalSizeClass, .compact).zoonkStyles())
    try await settle(window)
    XCTAssertEqual(
      try edge("value", probes: probes, window: window),
      try edge("row", probes: probes, window: window), accuracy: 0.5)
  }

  func testStackedValuesKeepTheWordsLeadingEdge() async throws {
    let probes = Probes()
    let window = try show(
      ZoonkList {
        Section {
          row("value", probes: probes).background(Probe(id: "row", probes: probes))
          row("custom", probes: probes).disclosureChevron()
        }
      }
      .environment(\.dynamicTypeSize, .accessibility3)
      .environment(\.horizontalSizeClass, .compact).zoonkStyles())
    try await settle(window)
    XCTAssertEqual(
      try edge("value", probes: probes, window: window, direction: .rightToLeft),
      try edge("row", probes: probes, window: window, direction: .rightToLeft), accuracy: 0.5)
  }

  private enum Kind { case custom, group }

  private func check(kind: Kind, direction: LayoutDirection = .leftToRight) async throws {
    let probes = Probes()
    let window = try show(
      NavigationStack {
        ZoonkList {
          Section {
            row("plain", probes: probes)
            if kind == .custom {
              row("other", probes: probes).disclosureChevron()
            } else {
              DisclosureGroup(isExpanded: .constant(false)) {
                Text(verbatim: "Contents")
              } label: {
                row("other", probes: probes)
              }
            }
          }
        }
      }
      .environment(\.layoutDirection, direction)
      .environment(\.horizontalSizeClass, .compact).zoonkStyles())
    try await settle(window)
    XCTAssertEqual(
      try edge("plain", probes: probes, window: window, direction: direction),
      try edge("other", probes: probes, window: window, direction: direction), accuracy: 0.5)
  }

  private func row(_ id: String, probes: Probes) -> some View {
    ListRow(Text(verbatim: id)) {
    } trailing: {
      Text(verbatim: "16 Feb").background(Probe(id: id, probes: probes))
    }
  }

  private func edge(
    _ id: String, probes: Probes, window: UIWindow, direction: LayoutDirection = .leftToRight
  ) throws -> CGFloat {
    let view = try XCTUnwrap(probes.views[id])
    let frame = view.convert(view.bounds, to: window)
    return direction == .rightToLeft ? frame.minX : frame.maxX
  }

  private func settle(_ window: UIWindow) async throws {
    for _ in 0..<10 {
      window.layoutIfNeeded()
      try await Task.sleep(for: .milliseconds(50))
    }
  }

}

@MainActor
private final class Probes {
  var views: [String: UIView] = [:]
}

private struct Probe: UIViewRepresentable {
  let id: String
  let probes: Probes

  func makeUIView(context: Context) -> UIView {
    let view = UIView()
    probes.views[id] = view
    return view
  }

  func updateUIView(_ uiView: UIView, context: Context) {
  }
}
