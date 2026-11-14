#if DEBUG
  import SwiftUI
  import UIKit

  /// `ZOONK_LAYOUT_CAPTURE=1` (also a launch argument, `-ZOONK_LAYOUT_CAPTURE 1`) has the shared
  /// pieces report what they laid out, and writes a capture of the screen whenever
  /// `scripts/layout-capture.mts` asks: each part's frame in points, a text's first baseline, its
  /// capitals and type role, each action's look, and the build the app came from. The web lane's
  /// checker reads it as it reads the web's (`REPORT-SHAPE.md` in the alignment notes). Without it,
  /// every report is a no-op.
  enum LayoutCapture {
    static let isOn =
      (ProcessInfo.processInfo.environment["ZOONK_LAYOUT_CAPTURE"]
        ?? UserDefaults.standard.string(forKey: "ZOONK_LAYOUT_CAPTURE")) != nil
  }

  // MARK: - What the pieces report

  @MainActor
  final class LayoutRegistry {
    static let shared = LayoutRegistry()

    enum Kind: Equatable {
      case row(LayoutPiece)
      case part(LayoutPart)
      case action(String)
      case anchor(String)
      case surface
    }

    /// A text's type role and where it draws, so a part's role is the one its first line is in.
    struct StyleRect: Equatable {
      let style: TypeStyle
      let rect: CGRect
    }

    struct Record {
      var kind: Kind
      var order: Int
      var row: UUID?
      var surface: UUID?
      var anchor: String?
      var frame: CGRect = .null
      var baseline: CGFloat?
      var inherited: TypeStyle?
      var styles: [StyleRect] = []
      var role: LayoutRole?
      var text: Text?
      var dynamicTypeSize: DynamicTypeSize = .large
      var legibility: LegibilityWeight?
      /// How much a transform above draws the view smaller or larger than it laid out, as a sheet
      /// behind another one does; a font's metrics are in layout points.
      var scale: CGFloat = 1
      /// At accessibility sizes a row puts its value under its title, where it isn't on the row's
      /// line or its end edge.
      var stacked = false
    }

    private(set) var records: [UUID: Record] = [:]
    private var lastOrder = 0

    func update(_ id: UUID, kind: Kind, _ change: (inout Record) -> Void) {
      if records[id] == nil {
        lastOrder += 1
        records[id] = Record(kind: kind, order: lastOrder)
        LayoutCaptureRequests.start()
      }

      change(&records[id]!)
    }

    func remove(_ id: UUID) {
      records[id] = nil
    }
  }

  extension EnvironmentValues {
    @Entry var layoutRowID: UUID?
    @Entry var layoutSurfaceID: UUID?
    @Entry var layoutAnchor: String?
  }

  struct LayoutTypeKey: PreferenceKey {
    struct Entry {
      let style: TypeStyle
      let bounds: Anchor<CGRect>
    }

    static let defaultValue: [Entry] = []

    static func reduce(value: inout [Entry], nextValue: () -> [Entry]) {
      value.append(contentsOf: nextValue())
    }
  }

  struct LayoutRoleKey: PreferenceKey {
    static let defaultValue: LayoutRole? = nil

    static func reduce(value: inout LayoutRole?, nextValue: () -> LayoutRole?) {
      value = value ?? nextValue()
    }
  }

  /// Where the view draws, in the window's points.
  private struct FrameProbe: View {
    let report: (CGRect) -> Void

    var body: some View {
      Color.clear
        .onGeometryChange(for: CGRect.self) {
          $0.frame(in: .global)
        } action: {
          report($0)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
  }

  extension View {
    /// The view's frame, and with `baseline` its first text baseline: a mark of no height placed on
    /// that baseline, as the stacks place their views.
    fileprivate func probes(
      baseline: ((CGFloat) -> Void)? = nil, frame: @escaping (CGRect) -> Void
    ) -> some View {
      overlay(alignment: .topLeading) { FrameProbe(report: frame) }
        .overlay(alignment: Alignment(horizontal: .leading, vertical: .firstTextBaseline)) {
          if let baseline {
            FrameProbe { baseline($0.minY) }
              .frame(width: 0, height: 0)
          }
        }
    }
  }

  struct LayoutRowReporter: ViewModifier {
    let piece: LayoutPiece

    @Environment(\.layoutSurfaceID) private var surface
    @State private var id = UUID()

    func body(content: Content) -> some View {
      if LayoutCapture.isOn {
        content
          .environment(\.layoutRowID, id)
          .probes { frame in
            LayoutRegistry.shared.update(id, kind: .row(piece)) {
              $0.frame = frame
              $0.surface = surface
            }
          }
          .onDisappear { LayoutRegistry.shared.remove(id) }
      } else {
        content
      }
    }
  }

  struct LayoutPartReporter: ViewModifier {
    let part: LayoutPart
    let text: Text?

    @Environment(\.layoutRowID) private var row
    @Environment(\.layoutSurfaceID) private var surface
    @Environment(\.layoutTypeStyle) private var inherited
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.legibilityWeight) private var legibility
    @Environment(\.stacksContent) private var isStacked
    @State private var id = UUID()

    func body(content: Content) -> some View {
      if LayoutCapture.isOn {
        content
          .overlayPreferenceValue(LayoutTypeKey.self) { entries in
            GeometryReader { proxy in
              let origin = proxy.frame(in: .global).origin
              let styles = entries.map {
                LayoutRegistry.StyleRect(
                  style: $0.style, rect: proxy[$0.bounds].offsetBy(dx: origin.x, dy: origin.y))
              }

              Color.clear
                .onChange(of: styles, initial: true) {
                  update { $0.styles = styles }
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
          }
          .overlayPreferenceValue(LayoutRoleKey.self) { role in
            Color.clear
              .onChange(of: role, initial: true) {
                update { $0.role = role }
              }
              .allowsHitTesting(false)
              .accessibilityHidden(true)
          }
          .probes { baseline in
            update { $0.baseline = baseline }
          } frame: { frame in
            update { $0.frame = frame }
          }
          .onGeometryChange(for: CGFloat.self) {
            $0.size.height > 0 ? $0.frame(in: .global).height / $0.size.height : 1
          } action: { scale in
            update { $0.scale = scale }
          }
          .onDisappear { LayoutRegistry.shared.remove(id) }
      } else {
        content
      }
    }

    private func update(_ change: (inout LayoutRegistry.Record) -> Void) {
      LayoutRegistry.shared.update(id, kind: .part(part)) {
        $0.row = row
        $0.surface = surface
        $0.inherited = inherited
        $0.text = text
        $0.dynamicTypeSize = dynamicTypeSize
        $0.legibility = legibility
        $0.stacked = isStacked
        change(&$0)
      }
    }
  }

  struct LayoutActionReporter: ViewModifier {
    let variant: String

    @Environment(\.layoutSurfaceID) private var surface
    @Environment(\.layoutAnchor) private var anchor
    @State private var id = UUID()

    func body(content: Content) -> some View {
      if LayoutCapture.isOn {
        content
          .probes { frame in
            LayoutRegistry.shared.update(id, kind: .action(variant)) {
              $0.frame = frame
              $0.surface = surface
              $0.anchor = anchor
            }
          }
          .onDisappear { LayoutRegistry.shared.remove(id) }
      } else {
        content
      }
    }
  }

  struct LayoutAnchorReporter: ViewModifier {
    let name: String

    @Environment(\.layoutSurfaceID) private var surface
    @State private var id = UUID()

    func body(content: Content) -> some View {
      if LayoutCapture.isOn {
        content
          .environment(\.layoutAnchor, name)
          .probes { frame in
            LayoutRegistry.shared.update(id, kind: .anchor(name)) {
              $0.frame = frame
              $0.surface = surface
            }
          }
          .onDisappear { LayoutRegistry.shared.remove(id) }
      } else {
        content
      }
    }
  }

  /// The app's root and each presented screen's: the surface their actions are counted on.
  struct LayoutSurfaceReporter: ViewModifier {
    @State private var id = UUID()

    func body(content: Content) -> some View {
      if LayoutCapture.isOn {
        content
          .environment(\.layoutSurfaceID, id)
          .probes { frame in
            LayoutRegistry.shared.update(id, kind: .surface) { $0.frame = frame }
          }
          .onDisappear { LayoutRegistry.shared.remove(id) }
      } else {
        content
      }
    }
  }

  struct LayoutTypeReporter: ViewModifier {
    let style: TypeStyle

    func body(content: Content) -> some View {
      if LayoutCapture.isOn {
        content.anchorPreference(key: LayoutTypeKey.self, value: .bounds) {
          [LayoutTypeKey.Entry(style: style, bounds: $0)]
        }
      } else {
        content
      }
    }
  }

  // MARK: - Requests

  /// `scripts/layout-capture.mts` writes `request.json` (`{"scenario", "screen"}`) in the app's
  /// `Documents/layout-capture`; the app answers with `<scenario>.json` beside it.
  @MainActor
  enum LayoutCaptureRequests {
    private static var isStarted = false

    static var folder: URL {
      URL.documentsDirectory.appending(path: "layout-capture", directoryHint: .isDirectory)
    }

    static func start() {
      guard !isStarted else { return }
      isStarted = true

      Task {
        while true {
          try? await Task.sleep(for: .milliseconds(300))
          answer()
        }
      }
    }

    private struct Request: Decodable {
      let scenario: String
      var screen: String?
    }

    private static func answer() {
      let requestURL = folder.appending(path: "request.json")

      guard let data = try? Data(contentsOf: requestURL),
        let request = try? JSONDecoder().decode(Request.self, from: data)
      else { return }

      try? FileManager.default.removeItem(at: requestURL)

      let capture = LayoutCaptureWriter.capture(
        scenario: request.scenario, screen: request.screen ?? request.scenario)
      let out = folder.appending(path: "\(request.scenario).json")

      if let json = try? JSONSerialization.data(
        withJSONObject: capture, options: [.prettyPrinted, .sortedKeys])
      {
        try? json.write(to: out, options: .atomic)
      }
    }
  }

  // MARK: - Writing a capture

  @MainActor
  enum LayoutCaptureWriter {
    static func capture(scenario: String, screen: String) -> [String: Any] {
      guard
        let window = UIApplication.shared.connectedScenes
          .compactMap({ ($0 as? UIWindowScene)?.keyWindow }).first
      else {
        return ["error": "no window"]
      }

      let picture = WindowPicture(window: window)
      let cells = ListCells(window: window)
      var writer = ElementWriter(picture: picture, cells: cells, window: window)

      return [
        "version": 1,
        "platform": "apple",
        "scenario": scenario,
        "screen": screen,
        "configuration": configuration(window),
        "unit": "pt",
        "scale": window.screen.scale,
        "activeSurface": writer.activeSurface,
        "elements": writer.elements(),
        "build": buildStamp,
        "measured": writer.measuredSummary,
      ]
    }

    private static func configuration(_ window: UIWindow) -> [String: Any] {
      let traits = window.traitCollection
      let scale = UIFontMetrics(forTextStyle: .body).scaledValue(for: 100, compatibleWith: traits)

      return [
        "size": traits.userInterfaceIdiom == .pad ? "tablet" : "phone",
        "width": window.bounds.width,
        "height": window.bounds.height,
        "pointer": "touch",
        "locale": Bundle.main.preferredLocalizations.first ?? "en",
        "textScale": (scale / 100 * 100).rounded() / 100,
        "contentSize": traits.preferredContentSizeCategory.rawValue,
        "scheme": traits.userInterfaceStyle == .dark ? "dark" : "light",
      ]
    }

    /// Written by the Debug build's "Stamp Debug Build" phase (`scripts/stamp-debug-build.sh`).
    private static var buildStamp: Any {
      guard let url = Bundle.main.url(forResource: "build-stamp", withExtension: "json"),
        let data = try? Data(contentsOf: url),
        let stamp = try? JSONSerialization.jsonObject(with: data)
      else {
        return ["commit": "unknown"]
      }

      return stamp
    }
  }

  /// The window as drawn, read only inside a known region: a mark's, an end's, or the room after a
  /// row where the system draws its chevron or accessory.
  @MainActor
  private struct WindowPicture {
    let scale: CGFloat
    /// Where the window shows content: a part past it, or under the status bar or the home
    /// indicator, is drawn there only in part.
    private let visible: CGRect
    private let width: Int
    private let height: Int
    private let pixels: [UInt8]

    init(window: UIWindow) {
      let format = UIGraphicsImageRendererFormat(for: window.traitCollection)
      format.opaque = true
      let image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { _ in
        window.drawHierarchy(in: window.bounds, afterScreenUpdates: false)
      }

      scale = format.scale
      visible = window.bounds.inset(by: window.safeAreaInsets)

      guard let cgImage = image.cgImage else {
        width = 0
        height = 0
        pixels = []
        return
      }

      let (pixelWidth, pixelHeight) = (cgImage.width, cgImage.height)
      var buffer = [UInt8](repeating: 0, count: pixelWidth * pixelHeight * 4)
      buffer.withUnsafeMutableBytes { bytes in
        let context = CGContext(
          data: bytes.baseAddress, width: pixelWidth, height: pixelHeight, bitsPerComponent: 8,
          bytesPerRow: pixelWidth * 4, space: CGColorSpaceCreateDeviceRGB(),
          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        context?.draw(cgImage, in: CGRect(x: 0, y: 0, width: pixelWidth, height: pixelHeight))
      }
      width = pixelWidth
      height = pixelHeight
      pixels = buffer
    }

    /// Whether all of `rect` is on the screen, so its pixels are all of its ink.
    func shows(_ rect: CGRect) -> Bool {
      visible.insetBy(dx: -0.5, dy: -0.5).contains(rect)
    }

    /// What differs from the region's most common color, in points; nil when nothing does.
    func ink(in rect: CGRect) -> CGRect? {
      let left = max(0, Int((rect.minX * scale).rounded(.down)))
      let right = min(width, Int((rect.maxX * scale).rounded(.up)))
      let top = max(0, Int((rect.minY * scale).rounded(.down)))
      let bottom = min(height, Int((rect.maxY * scale).rounded(.up)))

      guard left < right, top < bottom else { return nil }

      var counts: [UInt32: Int] = [:]

      for y in top..<bottom {
        for x in left..<right {
          counts[color(x, y), default: 0] += 1
        }
      }

      guard let background = counts.max(by: { $0.value < $1.value })?.key else { return nil }

      var box: (minX: Int, minY: Int, maxX: Int, maxY: Int)?

      for y in top..<bottom {
        for x in left..<right where differs(color(x, y), background) {
          box = (
            min(box?.minX ?? x, x), min(box?.minY ?? y, y), max(box?.maxX ?? x, x),
            max(box?.maxY ?? y, y)
          )
        }
      }

      return box.map {
        CGRect(
          x: CGFloat($0.minX) / scale, y: CGFloat($0.minY) / scale,
          width: CGFloat($0.maxX - $0.minX + 1) / scale,
          height: CGFloat($0.maxY - $0.minY + 1) / scale)
      }
    }

    private func color(_ x: Int, _ y: Int) -> UInt32 {
      let index = (y * width + x) * 4
      return UInt32(pixels[index]) << 16 | UInt32(pixels[index + 1]) << 8
        | UInt32(pixels[index + 2])
    }

    /// Antialiased edges included: a channel more than 24 of 255 off the background.
    private func differs(_ one: UInt32, _ other: UInt32) -> Bool {
      [16, 8, 0].contains { shift in
        abs(Int((one >> UInt32(shift)) & 0xFF) - Int((other >> UInt32(shift)) & 0xFF)) > 24
      }
    }
  }

  /// A list's rows and sections as the system laid them out: a section is a group, a cell a row.
  @MainActor
  private struct ListCells {
    struct Cell {
      let section: String
      let frame: CGRect
      /// Where the cell's content ends: its frame less its trailing layout margin.
      let contentEnd: CGFloat
    }

    let cells: [Cell]

    init(window: UIWindow) {
      var found: [Cell] = []
      var listIndex = 0

      func visit(_ view: UIView) {
        if let list = view as? UICollectionView, !list.isHidden, list.window != nil {
          listIndex += 1

          for cell in list.visibleCells {
            guard let path = list.indexPath(for: cell) else { continue }
            let frame = cell.convert(cell.bounds, to: window)
            found.append(
              Cell(
                section: "list\(listIndex).section\(path.section)", frame: frame,
                contentEnd: frame.maxX - cell.layoutMargins.right))
          }
        }

        view.subviews.forEach(visit)
      }

      // The top screen's lists: a screen under a sheet keeps its cells in the window.
      var top = window.rootViewController
      while let presented = top?.presentedViewController, !presented.isBeingDismissed {
        top = presented
      }

      visit(top?.view ?? window)
      cells = found
    }

    func cell(containing rect: CGRect) -> Cell? {
      let center = CGPoint(x: rect.midX, y: rect.midY)
      return cells.filter { $0.frame.contains(center) }.min {
        $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height
      }
    }
  }

  @MainActor
  private struct ElementWriter {
    let picture: WindowPicture
    let cells: ListCells
    let window: UIWindow

    private let records: [(id: UUID, record: LayoutRegistry.Record)]
    private var notMeasured = 0
    private var measured = 0

    init(picture: WindowPicture, cells: ListCells, window: UIWindow) {
      self.picture = picture
      self.cells = cells
      self.window = window
      let shown = LayoutRegistry.shared.records
        .filter { !$0.value.frame.isNull && $0.value.frame.intersects(window.bounds) }
        .map { (id: $0.key, record: $0.value) }
        .sorted { $0.record.order < $1.record.order }
      let active = shown.last { $0.record.kind == .surface }?.id

      // Rows and their parts are the top screen's; what's under a sheet keeps its actions and
      // anchors, which a state pair and the count of filled actions read by their surface.
      records = shown.filter {
        switch $0.record.kind {
        case .row, .part: $0.record.surface == active
        default: true
        }
      }
    }

    /// A text part that is only the row's end glyph (a chevron in a row's trailing slot) is that end.
    private func isEndGlyph(_ record: LayoutRegistry.Record) -> Bool {
      records.contains {
        $0.record.kind == .part(.end)
          && $0.record.frame.insetBy(dx: -0.5, dy: -0.5)
            .contains(record.frame)
      }
    }

    private var surfaces: [UUID: String] {
      let ordered = records.filter { $0.record.kind == .surface }
      return Dictionary(
        uniqueKeysWithValues: ordered.enumerated().map { index, surface in
          (surface.id, index == 0 ? "page" : "sheet \(index)")
        })
    }

    /// The last screen presented, or the page.
    var activeSurface: String {
      records.last { $0.record.kind == .surface }.flatMap { surfaces[$0.id] } ?? "page"
    }

    var measuredSummary: [String: Int] {
      ["parts": measured, "notMeasured": notMeasured]
    }

    mutating func elements() -> [[String: Any]] {
      var out: [[String: Any]] = []
      var groupIDs: [String: String] = [:]
      var rowIDs: [String: String] = [:]
      var reportedCells = Set<String>()

      func cellKey(_ cell: ListCells.Cell) -> String {
        "\(cell.section):\(Int(cell.frame.minY))"
      }

      /// A part's row: its piece's row, else the list cell it's in.
      func rowOf(_ record: LayoutRegistry.Record) -> (row: String, group: String)? {
        let rowRecord = record.row.flatMap { id in records.first { $0.id == id } }
        let place = rowRecord?.record.frame ?? record.frame

        guard let cell = cells.cell(containing: place) else { return nil }

        let piece: String
        if case .row(let declared) = rowRecord?.record.kind {
          piece = declared.rawValue
        } else {
          piece = LayoutPiece.listGroup.rawValue
        }

        let groupID =
          groupIDs[cell.section]
          ?? {
            let id = "g\(groupIDs.count)"
            groupIDs[cell.section] = id
            let inSection = cells.cells.filter { $0.section == cell.section }
            let bounds = inSection.reduce(CGRect.null) { $0.union($1.frame) }
            out.append([
              "id": id, "piece": piece, "part": "group", "group": NSNull(), "row": NSNull(),
              "bounds": Self.bounds(bounds), "ink": Self.bounds(bounds),
              "endEdge": Self.round(inSection.map(\.contentEnd).max() ?? bounds.maxX),
              "gap": 0,
            ])
            return id
          }()

        let key = cellKey(cell)
        reportedCells.insert(key)

        let rowID =
          rowIDs[key]
          ?? {
            let id = "\(groupID).r\(rowIDs.count)"
            rowIDs[key] = id
            var row: [String: Any] = [
              "id": id, "piece": piece, "part": "row", "group": groupID, "row": NSNull(),
              "bounds": Self.bounds(cell.frame),
              "ink": Self.bounds(rowRecord?.record.frame ?? place),
              "flow": cell.section, "gapBefore": 0, "margins": [0, 0],
              "endEdge": Self.round(cell.contentEnd),
            ]
            if record.stacked {
              row["stacked"] = true
            }
            out.append(row)
            return id
          }()

        return (rowID, groupID)
      }

      let surfaces = surfaces
      var seenParts = Set<String>()

      for (index, (_, record)) in records.enumerated() {
        switch record.kind {
        case .part(let part):
          // A view drawn twice, such as one an accessibility representation repeats, is one part.
          let key = "\(part):\(record.row?.uuidString ?? ""):\(record.frame)"
          guard part == .end || part == .mark || !isEndGlyph(record),
            seenParts.insert(key).inserted, let place = rowOf(record)
          else { continue }
          var element = part == .end ? endElement(record) : partElement(part, record)
          element["id"] = "\(place.row).p\(index)"
          element["group"] = place.group
          element["row"] = place.row
          element["piece"] = out.first { $0["id"] as? String == place.group }?["piece"]
          out.append(element)
        case .action(let variant):
          // Only a main action's fill counts; another look is written only as a pair's anchor.
          guard variant == "filled" || record.anchor != nil else { continue }
          measured += 1
          let surface = record.surface.flatMap { surfaces[$0] } ?? "page"
          var element: [String: Any] = [
            "id": "a\(index)", "piece": "action", "part": variant == "filled" ? "action" : "anchor",
            "group": NSNull(), "row": NSNull(), "bounds": Self.bounds(record.frame),
            "ink": Self.bounds(record.frame), "variant": variant, "surface": surface,
          ]
          if let anchor = record.anchor {
            element["anchor"] = "\(surface)/\(anchor).\(variant)"
          }
          out.append(element)
        case .anchor(let name):
          out.append([
            "id": "anchor\(index)", "piece": "anchor", "part": "anchor", "group": NSNull(),
            "row": NSNull(), "bounds": Self.bounds(record.frame), "ink": "not measured",
            "anchor": "\(record.surface.flatMap { surfaces[$0] } ?? "page")/\(name)",
          ])
        case .surface:
          let name = surfaces[records[index].id] ?? "page"
          out.append([
            "id": "surface\(index)", "piece": "surface", "part": "anchor", "group": NSNull(),
            "row": NSNull(), "bounds": Self.bounds(record.frame), "ink": "not measured",
            "anchor": name, "name": name,
          ])
        case .row:
          continue
        }
      }

      let systemEnds = systemEnds(rowIDs: rowIDs, cellKey: cellKey)
      out.append(contentsOf: systemEnds)
      out.append(
        contentsOf: unreportedRows(reported: reportedCells, groups: groupIDs, cellKey: cellKey))

      // The system lays out its own chevron, and its glyph ends inside the margin a value without
      // one reaches; that row's end edge is where the system ends it.
      let systemEdges = Dictionary(
        systemEnds.compactMap { end -> (String, Double)? in
          guard let row = end["row"] as? String, let ink = end["ink"] as? [Double] else {
            return nil
          }
          return (row, ink[0] + ink[2])
        }, uniquingKeysWith: max)

      let rowsWithNotes = Set(
        out.filter { $0["part"] as? String == LayoutPart.note.rawValue }.compactMap {
          $0["row"] as? String
        })

      return out.map { element in
        guard element["part"] as? String == "row", let id = element["id"] as? String,
          element["group"] is String
        else { return element }
        var row = element
        row["note"] = rowsWithNotes.contains(id)
        if let edge = systemEdges[id] {
          row["endEdge"] = edge
        }
        return row
      }
    }

    /// A text's frame and first line: its baseline, its capitals from its font, its type role.
    private mutating func partElement(_ part: LayoutPart, _ record: LayoutRegistry.Record)
      -> [String: Any]
    {
      var element: [String: Any] = ["part": part.rawValue, "bounds": Self.bounds(record.frame)]

      if part == .mark {
        guard picture.shows(record.frame) else { return clipped(element) }
        measured += 1
        element["ink"] = picture.ink(in: record.frame).map(Self.bounds) ?? NSNull()
        return element
      }

      element["ink"] = Self.bounds(record.frame)
      element["text"] = record.text.flatMap(Self.words)

      guard let baseline = record.baseline,
        let style = record.styles
          .filter({ $0.rect.minY - 0.5 <= baseline && baseline <= $0.rect.maxY + 0.5 })
          .min(by: { $0.rect.width * $0.rect.height < $1.rect.width * $1.rect.height })?.style
          ?? record.inherited
      else {
        notMeasured += 1
        element["baseline"] = "not measured"
        element["capTop"] = "not measured"
        element["capBottom"] = "not measured"
        element["type"] = "not measured"
        return element
      }

      measured += 1
      let font = style.layoutFont(record.dynamicTypeSize, legibility: record.legibility)
      element["baseline"] = Self.round(baseline)
      element["capTop"] = Self.round(baseline - font.capHeight * record.scale)
      element["capBottom"] = Self.round(baseline)
      element["type"] = style.layoutName
      element["firstLine"] = Self.bounds(
        CGRect(
          x: record.frame.minX, y: record.frame.minY, width: record.frame.width,
          height: baseline - font.descender * record.scale - record.frame.minY))

      if part == .label {
        let spacing = style.layoutLineSpacing(font)
        let height = record.frame.height / record.scale
        element["lines"] = max(1, Int(((height + spacing) / (font.lineHeight + spacing)).rounded()))
      }

      if let role = record.role {
        element["role"] = role.rawValue
      }

      return element
    }

    /// An end the piece draws: its ink, or a holder when it keeps the room and draws nothing.
    private mutating func endElement(_ record: LayoutRegistry.Record) -> [String: Any] {
      guard picture.shows(record.frame) else {
        return clipped(["part": "end", "bounds": Self.bounds(record.frame)])
      }

      measured += 1

      guard let ink = picture.ink(in: record.frame) else {
        return [
          "part": "holder", "bounds": Self.bounds(record.frame), "ink": NSNull(),
          "name": "the chevron's kept slot",
        ]
      }

      return ["part": "end", "bounds": Self.bounds(record.frame), "ink": Self.bounds(ink)]
    }

    /// A part read from pixels that the screen's edge cuts: its ink can't be told from the picture.
    private mutating func clipped(_ element: [String: Any]) -> [String: Any] {
      notMeasured += 1
      var element = element
      element["ink"] = "not measured"
      element["clipped"] = true
      return element
    }

    /// What the system draws after a row's content (a link's chevron, a checkmark), read from the
    /// picture between the content's end and the cell's.
    private mutating func systemEnds(rowIDs: [String: String], cellKey: (ListCells.Cell) -> String)
      -> [[String: Any]]
    {
      cells.cells.compactMap { cell in
        guard let rowID = rowIDs[cellKey(cell)] else { return nil }

        let contentEnd = records.filter {
          if case .part = $0.record.kind {
            return cell.frame.contains(CGPoint(x: $0.record.frame.midX, y: $0.record.frame.midY))
          }
          return false
        }.map(\.record.frame.maxX).max()

        guard let contentEnd,
          let ink = picture.ink(
            in: CGRect(
              x: contentEnd + 1, y: cell.frame.minY + 1, width: cell.contentEnd - contentEnd + 1,
              height: cell.frame.height - 2)),
          // A glyph, such as a chevron or a checkmark; not a scroll indicator's sliver.
          ink.width >= 3, ink.width <= 24, ink.height <= 24
        else { return nil }

        measured += 1
        return [
          "id": "\(rowID).system", "piece": LayoutPiece.listGroup.rawValue, "part": "end",
          "group": rowID.components(separatedBy: ".").first ?? NSNull(), "row": rowID,
          "bounds": Self.bounds(ink), "ink": Self.bounds(ink),
          "name": "drawn by the system after the row (from the picture)",
          "source": "picture",
        ]
      }
    }

    /// List rows no shared piece reports: written so they count, never guessed at.
    /// In a group with measured rows, they stay its neighbors, so a gap is read between rows that
    /// really are next to each other.
    private mutating func unreportedRows(
      reported: Set<String>, groups: [String: String], cellKey: (ListCells.Cell) -> String
    ) -> [[String: Any]] {
      cells.cells.filter { !reported.contains(cellKey($0)) }.enumerated().map { index, cell in
        notMeasured += 1
        let group = groups[cell.section]
        return [
          "id": group.map { "\($0).u\(index)" } ?? "u\(index)",
          "piece": group == nil ? "unreported" : LayoutPiece.listGroup.rawValue, "part": "row",
          "group": group ?? NSNull(), "row": NSNull(), "bounds": Self.bounds(cell.frame),
          "ink": "not measured", "flow": cell.section, "gapBefore": 0, "margins": [0, 0],
          "name": "a list row no shared piece reports",
        ]
      }
    }

    private static func round(_ value: CGFloat) -> Double {
      (Double(value) * 100).rounded() / 100
    }

    private static func bounds(_ rect: CGRect) -> [Double] {
      [round(rect.minX), round(rect.minY), round(rect.width), round(rect.height)]
    }

    /// A text's words, to name its row in a finding: its verbatim string or localization key.
    static func words(_ text: Text) -> String? {
      func search(_ value: Any, depth: Int) -> String? {
        if let string = value as? String { return string }
        guard depth < 8 else { return nil }
        for child in Mirror(reflecting: value).children {
          if let found = search(child.value, depth: depth + 1) { return found }
        }
        return nil
      }

      return search(text, depth: 0)
    }
  }

  extension TypeStyle {
    /// The room a role's own line height adds between lines, as `typeStyle(_:)` sets it.
    func layoutLineSpacing(_ font: UIFont) -> CGFloat {
      lineHeight.map { max(0, $0 * font.pointSize - font.lineHeight) } ?? 0
    }

    private static let names: [TypeStyle: String] = Dictionary(
      [
        (heroTitle, "heroTitle"), (pageTitle, "pageTitle"), (section, "section"),
        (question, "question"), (screenTitle, "screenTitle"), (lessonText, "lessonText"),
        (lead, "lead"), (reading, "reading"), (message, "message"), (writing, "writing"),
        (button, "button"), (body, "body"), (rowTitle, "rowTitle"), (sectionTitle, "sectionTitle"),
        (smallButton, "smallButton"), (note, "note"), (meta, "meta"), (data, "data"),
        (eyebrow, "eyebrow"), (label, "label"), (verdict, "verdict"), (tag, "tag"),
        (chip, "chip"), (small, "small"), (readout, "readout"), (momentReadout, "momentReadout"),
        (letterReadout, "letterReadout"),
      ], uniquingKeysWith: { first, _ in first })

    /// The design system's role, or the role it changes the weight of.
    var layoutName: String {
      if let name = Self.names[self] { return name }

      let base = Self.names.sorted { $0.value < $1.value }.first { role, _ in
        var same = role
        same.weight = weight
        return same == self
      }

      return base.map { "\($0.value) \(weightName)" }
        ?? "\(face == .mono ? "Geist Mono" : "Geist") \(size) \(weightName)"
    }

    private var weightName: String {
      switch weight {
      case .ultraLight: "ultraLight"
      case .thin: "thin"
      case .light: "light"
      case .medium: "medium"
      case .semibold: "semibold"
      case .bold: "bold"
      case .heavy: "heavy"
      case .black: "black"
      default: "regular"
      }
    }
  }
#endif
