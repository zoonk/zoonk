import SwiftUI

struct PaneSplit<Primary: View, Secondary: View, Single: View>: View {
  /// The primary pane's share of the width where there's no hinge.
  let primaryShare: CGFloat
  /// A question and the learner's turn read as one screen, so text too large for two pages makes
  /// it one column, even at a hinge (`PaneSpace.panes(primaryShare:stacked:)`).
  let isSpread: Bool
  let primary: Primary
  let secondary: Secondary
  let single: Single

  @Environment(\.stacksContent) private var isStacked

  init(
    primaryShare: CGFloat = 0.5,
    isSpread: Bool = false,
    @ViewBuilder primary: () -> Primary,
    @ViewBuilder secondary: () -> Secondary,
    @ViewBuilder single: () -> Single
  ) {
    self.primaryShare = primaryShare
    self.isSpread = isSpread
    self.primary = primary()
    self.secondary = secondary()
    self.single = single()
  }

  var body: some View {
    // A reader, so the panes are chosen in the same layout pass: a wide screen never shows the
    // one-column version first.
    GeometryReader { proxy in
      let space = PaneSpace(proxy)
      let panes =
        isSpread
        ? space.panes(primaryShare: primaryShare, stacked: isStacked)
        : space.pages(primaryShare: primaryShare, stacked: isStacked)

      Group {
        if let panes {
          HStack(spacing: 0) {
            primary
              .frame(width: panes.primary)
              .frame(maxHeight: .infinity, alignment: .top)

            // The hinge is the secondary pane's safe area, like the camera's: its background runs
            // through it while its content and bars stay clear of it.
            secondary
              .safeAreaPadding(.leading, panes.gap)
              .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
          }
          .environment(\.isPaneSplit, true)
          // A list right under the bar has no top margin, but SwiftUI decides it once per
          // collection view and gives a pane one it kept off screen through a fold or resize,
          // which brings back the margin it had there: one page would start lower than the other.
          .contentMargins(.top, 0, for: .scrollContent)
        } else {
          single
            .safeAreaPadding(.trailing, space.lonePageInset)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }
}

/// A pane beside `content` wherever `PaneSplit` would split. Unlike `PaneSplit`'s builders,
/// `content` keeps its identity as the pane comes and goes, so a navigation stack in it keeps its
/// pages, and what the learner typed or opened on them, through a fold or a resize.
struct PaneBeside<Pane: View, Content: View>: View {
  var isAvailable = true
  /// Only where a hinge makes two pages, for what an open book shows beside a screen that's one
  /// column on a phone and a tablet.
  var atHingeOnly = false
  var paneEdge = HorizontalEdge.leading
  /// The leading side's share of the width where there's no hinge, as in `PaneSplit`.
  var primaryShare: CGFloat = 0.5
  @ViewBuilder let pane: () -> Pane
  @ViewBuilder let content: (_ isBeside: Bool) -> Content

  @Environment(\.stacksContent) private var isStacked

  var body: some View {
    GeometryReader { proxy in
      let panes =
        isAvailable
        ? PaneSpace(proxy).pages(
          primaryShare: primaryShare, stacked: isStacked, atHingeOnly: atHingeOnly) : nil
      let isTrailingPane = panes != nil && paneEdge == .trailing

      HStack(spacing: 0) {
        if let panes, paneEdge == .leading {
          pane()
            .frame(width: panes.primary)
            .frame(maxHeight: .infinity, alignment: .top)
            // The pane comes back with a list kept off screen, as in `PaneSplit`.
            .contentMargins(.top, 0, for: .scrollContent)
        }

        content(panes != nil)
          .safeAreaPadding(.leading, paneEdge == .leading ? panes?.gap ?? 0 : 0)
          .frame(width: isTrailingPane ? panes?.primary : nil)
          .frame(maxWidth: isTrailingPane ? nil : .infinity, maxHeight: .infinity, alignment: .top)
          // Level with the pane, as both of `PaneSplit`'s are.
          .contentMargins(.top, panes == nil ? nil : 0, for: .scrollContent)

        if let panes, paneEdge == .trailing {
          pane()
            .safeAreaPadding(.leading, panes.gap)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .contentMargins(.top, 0, for: .scrollContent)
        }
      }
      .environment(\.isPaneSplit, panes != nil)
    }
  }
}

struct PaneSpace: Equatable {
  /// Every iPhone layout works at this width at standard text sizes. It doesn't grow with the text:
  /// where it would, a hinge sets the pages anyway, and elsewhere stacked content gets one column.
  static let minimumPane: CGFloat = 360

  /// Without a hinge, a page and what supports it go side by side only from about a landscape
  /// iPad's width. Narrower, such as any iPad in portrait or a window that size, the page is one
  /// centered column with the phone's structure, as main's tablet portrait.
  static let minimumPagesWidth: CGFloat = 1100

  struct Panes: Equatable {
    var primary: CGFloat
    var gap: CGFloat
  }

  var width: CGFloat
  /// In the view's own leading-to-trailing coordinates, flat or folded.
  var hinge: ClosedRange<CGFloat>?
  /// The hinge while iPhone Duo is partially folded like a book: nothing may sit in it then.
  var fold: ClosedRange<CGFloat>?

  init(width: CGFloat, fold: ClosedRange<CGFloat>? = nil, hinge: ClosedRange<CGFloat>? = nil) {
    self.width = width
    self.fold = fold
    self.hinge = hinge ?? fold
  }

  init(_ proxy: GeometryProxy) {
    width = proxy.size.width

    // Reserved regions arrive in iOS 27.1; before it there's no hinge. Frames come mirrored for
    // right-to-left layouts, so they line up with the stacks they position.
    if #available(iOS 27.1, *) {
      let region =
        proxy
        .reservedRegions(kind: .division, options: .includeInactive)
        .first {
          $0.frame.height > $0.frame.width && $0.frame.minX > 0
            && $0.frame.maxX < proxy.size.width
        }

      hinge = region.map { $0.frame.minX...$0.frame.maxX }
      fold = region?.isActive == true ? hinge : nil
    }
  }

  /// A spread: a question and the learner's turn. One column where content stacks
  /// (`stacksContent`), whose text is too large for the two halves to read as one screen.
  func panes(primaryShare: CGFloat, stacked: Bool) -> Panes? {
    stacked ? nil : panes(primaryShare: primaryShare)
  }

  /// A page and what supports it. At a hinge they keep a page each at any text size: the hinge sets
  /// each page's width, about a phone's, and the text reflows inside it as on a phone. Elsewhere
  /// content that stacks gets one column, where a pane would be too narrow for it.
  func pages(primaryShare: CGFloat, stacked: Bool, atHingeOnly: Bool = false) -> Panes? {
    hinge == nil && (stacked || atHingeOnly || width < Self.minimumPagesWidth)
      ? nil : panes(primaryShare: primaryShare)
  }

  /// What a column alone leaves out to keep to the page before the hinge: the hinge and the page
  /// after it.
  var lonePageInset: CGFloat {
    hinge.map { width - $0.lowerBound } ?? 0
  }

  /// Decided on the shares, so the hinge never collapses the panes; where there's a hinge, they meet
  /// at it.
  func panes(primaryShare: CGFloat) -> Panes? {
    // A hundredth of a point of slack, so a share like 1 - 0.55 doesn't miss the minimum by a
    // floating-point rounding error.
    guard width * min(primaryShare, 1 - primaryShare) >= Self.minimumPane - 0.01 else {
      return nil
    }

    guard let hinge else {
      return Panes(primary: width * primaryShare, gap: 0)
    }

    return Panes(primary: hinge.lowerBound, gap: hinge.upperBound - hinge.lowerBound)
  }
}

extension PaneSpace {
  struct Column: Equatable {
    var width: CGFloat
    var spacing: CGFloat
  }

  /// The same number of columns on each side, so the grid stays even, with the hinge as the gap
  /// between the halves, flat or folded.
  func columnsAroundHinge(minimum: CGFloat, spacing: CGFloat) -> [Column]? {
    guard let hinge else {
      return nil
    }

    let leading = hinge.lowerBound
    let trailing = width - hinge.upperBound
    let perSide = max(
      Int(((min(leading, trailing) + spacing) / (minimum + spacing)).rounded(.down)), 1)

    func side(_ room: CGFloat, spacingAfter: CGFloat) -> [Column] {
      let column = (room - CGFloat(perSide - 1) * spacing) / CGFloat(perSide)
      return (0..<perSide).map {
        Column(width: column, spacing: $0 == perSide - 1 ? spacingAfter : spacing)
      }
    }

    return side(leading, spacingAfter: hinge.upperBound - hinge.lowerBound)
      + side(trailing, spacingAfter: 0)
  }
}

extension EnvironmentValues {
  @Entry var isPaneSplit = false
}
