import SwiftUI

struct PaneSplit<Primary: View, Secondary: View, Single: View>: View {
  /// The primary pane's share of the width where there's no hinge.
  let primaryShare: CGFloat
  let primary: Primary
  let secondary: Secondary
  let single: Single

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  init(
    primaryShare: CGFloat = 0.5,
    @ViewBuilder primary: () -> Primary,
    @ViewBuilder secondary: () -> Secondary,
    @ViewBuilder single: () -> Single
  ) {
    self.primaryShare = primaryShare
    self.primary = primary()
    self.secondary = secondary()
    self.single = single()
  }

  var body: some View {
    // A reader, so the panes are chosen in the same layout pass: a wide screen never shows the
    // one-column version first.
    GeometryReader { proxy in
      let panes =
        dynamicTypeSize.isAccessibilitySize
        ? nil : PaneSpace(proxy).panes(primaryShare: primaryShare)

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
        } else {
          single
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }
}

struct PaneSpace: Equatable {
  /// Every iPhone layout works at this width at standard text sizes, and accessibility sizes get one
  /// column, so it doesn't grow with the text.
  static let minimumPane: CGFloat = 360

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

  /// The same number of columns on each side, so the grid stays even, with the fold as the gap
  /// between the halves.
  func columnsAroundFold(minimum: CGFloat, spacing: CGFloat) -> [Column]? {
    guard let fold else {
      return nil
    }

    let leading = fold.lowerBound
    let trailing = width - fold.upperBound
    let perSide = max(
      Int(((min(leading, trailing) + spacing) / (minimum + spacing)).rounded(.down)), 1)

    func side(_ room: CGFloat, spacingAfter: CGFloat) -> [Column] {
      let column = (room - CGFloat(perSide - 1) * spacing) / CGFloat(perSide)
      return (0..<perSide).map {
        Column(width: column, spacing: $0 == perSide - 1 ? spacingAfter : spacing)
      }
    }

    return side(leading, spacingAfter: fold.upperBound - fold.lowerBound)
      + side(trailing, spacingAfter: 0)
  }
}

extension EnvironmentValues {
  @Entry var isPaneSplit = false
}
