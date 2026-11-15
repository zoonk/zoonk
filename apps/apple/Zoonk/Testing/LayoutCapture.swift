#if DEBUG
  import CryptoKit
  import SwiftUI
  import Synchronization
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
      /// A row whose layout put its value under its title (`layoutStacks(_:)`).
      var stacked = false
      /// An action drawn disabled: it still counts toward one filled action, and says it's disabled.
      var disabled = false
      /// A view of UIKit's inside this one, whose superviews are the views that really hold it: the
      /// scroll views and other clipping views that can cut it.
      weak var host: UIView? {
        didSet { hosted = hosted || host != nil }
      }
      /// Its host was placed once: a view drawn into a picture never gets one, and says nothing.
      private(set) var hosted = false
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

  struct LayoutStackedKey: PreferenceKey {
    static let defaultValue = false

    static func reduce(value: inout Bool, nextValue: () -> Bool) {
      value = value || nextValue()
    }
  }

  /// The first line of each text a part drew, as its runs came out: a run in a fallback face (a
  /// script or an emoji the font lacks) or another font has its own ascent.
  struct DrawnLine: Equatable, Sendable {
    let ascents: [CGFloat]
    let lines: Int
  }

  /// What `LayoutRunsProbe` saw, by part; it draws on the render thread.
  final class LayoutRuns: Sendable {
    static let shared = LayoutRuns()

    private let drawn = Mutex<[UUID: [String: DrawnLine]]>([:])

    func record(_ line: DrawnLine, key: String, part: UUID) {
      drawn.withLock { $0[part, default: [:]][key] = line }
    }

    func lines(of part: UUID) -> [DrawnLine] {
      drawn.withLock { Array(($0[part] ?? [:]).values) }
    }

    func forget(_ part: UUID) {
      _ = drawn.withLock { $0.removeValue(forKey: part) }
    }
  }

  /// Draws text as it would draw anyway, noting each text's first line.
  struct LayoutRunsProbe: TextRenderer {
    let part: UUID

    func draw(layout: Text.Layout, in context: inout GraphicsContext) {
      if let first = layout.first {
        LayoutRuns.shared.record(
          DrawnLine(ascents: first.map(\.typographicBounds.ascent), lines: layout.count),
          key: "\(first.typographicBounds.rect)", part: part)
      }

      for line in layout {
        context.draw(line)
      }
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
      baseline: ((CGFloat) -> Void)? = nil, frame: @escaping (CGRect) -> Void,
      host: @escaping (UIView) -> Void
    ) -> some View {
      overlay(alignment: .topLeading) { FrameProbe(report: frame) }
        .overlay(alignment: Alignment(horizontal: .leading, vertical: .firstTextBaseline)) {
          if let baseline {
            FrameProbe { baseline($0.minY) }
              .frame(width: 0, height: 0)
          }
        }
        .background { HostProbe(report: host) }
    }
  }

  /// A view of UIKit's of no size, placed in the view, so its superviews say what holds the view.
  private struct HostProbe: UIViewRepresentable {
    let report: (UIView) -> Void

    func makeUIView(context: Context) -> ProbeView {
      let view = ProbeView()
      view.isUserInteractionEnabled = false
      view.isAccessibilityElement = false
      view.report = report
      return view
    }

    func updateUIView(_ view: ProbeView, context: Context) {}

    final class ProbeView: UIView {
      var report: ((UIView) -> Void)?

      override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil {
          report?(self)
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
          .overlayPreferenceValue(LayoutStackedKey.self) { stacked in
            Color.clear
              .onChange(of: stacked, initial: true) {
                update { $0.stacked = stacked }
              }
              .allowsHitTesting(false)
              .accessibilityHidden(true)
          }
          .probes { frame in
            update { $0.frame = frame }
          } host: { host in
            update { $0.host = host }
          }
          .onDisappear { LayoutRegistry.shared.remove(id) }
      } else {
        content
      }
    }

    private func update(_ change: (inout LayoutRegistry.Record) -> Void) {
      LayoutRegistry.shared.update(id, kind: .row(piece)) {
        $0.surface = surface
        change(&$0)
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
    @State private var id = UUID()

    func body(content: Content) -> some View {
      if LayoutCapture.isOn {
        content
          .textRenderer(LayoutRunsProbe(part: id))
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
          } host: { host in
            update { $0.host = host }
          }
          .onGeometryChange(for: CGFloat.self) {
            $0.size.height > 0 ? $0.frame(in: .global).height / $0.size.height : 1
          } action: { scale in
            update { $0.scale = scale }
          }
          .onDisappear {
            LayoutRegistry.shared.remove(id)
            LayoutRuns.shared.forget(id)
          }
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
        change(&$0)
      }
    }
  }

  struct LayoutActionReporter: ViewModifier {
    let variant: String

    @Environment(\.layoutSurfaceID) private var surface
    @Environment(\.layoutAnchor) private var anchor
    @Environment(\.isEnabled) private var isEnabled
    @State private var id = UUID()

    func body(content: Content) -> some View {
      if LayoutCapture.isOn {
        content
          .probes { frame in
            LayoutRegistry.shared.update(id, kind: .action(variant)) {
              $0.frame = frame
              $0.surface = surface
              $0.anchor = anchor
              $0.disabled = !isEnabled
            }
          } host: { host in
            LayoutRegistry.shared.update(id, kind: .action(variant)) { $0.host = host }
          }
          .onChange(of: isEnabled) { _, isEnabled in
            LayoutRegistry.shared.update(id, kind: .action(variant)) { $0.disabled = !isEnabled }
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
          } host: { host in
            LayoutRegistry.shared.update(id, kind: .anchor(name)) { $0.host = host }
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
          } host: { host in
            LayoutRegistry.shared.update(id, kind: .surface) { $0.host = host }
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
  /// `Documents/layout-capture`; the app answers with `<scenario>.png`, the frame it measured, then
  /// `<scenario>.json` beside it, which names the picture by its SHA-256.
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
        scenario: request.scenario, screen: request.screen ?? request.scenario,
        picture: folder.appending(path: "\(request.scenario).png"))
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
    /// The capture, with the picture its pixel reads came from written to `pictureURL`.
    static func capture(scenario: String, screen: String, picture pictureURL: URL) -> [String: Any]
    {
      guard
        let window = UIApplication.shared.connectedScenes
          .compactMap({ ($0 as? UIWindowScene)?.keyWindow }).first
      else {
        return ["error": "no window"]
      }

      let picture = WindowPicture(window: window)
      let cells = ListCells(window: window)
      var writer = ElementWriter(picture: picture, cells: cells, window: window)

      guard let png = picture.png, (try? png.write(to: pictureURL, options: .atomic)) != nil else {
        return ["error": "the window couldn't be drawn"]
      }

      let elements = writer.elements()

      return [
        "picture": [
          "file": pictureURL.lastPathComponent,
          "sha256": SHA256.hash(data: png).map { String(format: "%02x", $0) }.joined(),
          "pixels": [picture.pixelWidth, picture.pixelHeight],
        ],
        "version": 1,
        "platform": "apple",
        "scenario": scenario,
        "screen": screen,
        "configuration": configuration(window),
        "unit": "pt",
        "scale": window.screen.scale,
        "activeSurface": writer.activeSurface,
        "elements": elements,
        "build": buildStamp,
        "measured": LayoutCounts.of(elements),
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

  /// Where content shows: the window less its safe area (the status bar, the home indicator), and
  /// inside each view that really holds a part and clips it (a list, a scroll view, a clipped
  /// box), what that view shows, less its bars.
  struct LayoutViewports {
    let window: CGRect

    init(window: CGRect) {
      self.window = window
    }

    @MainActor
    init(window: UIWindow) {
      self.init(window: window.bounds.inset(by: window.safeAreaInsets))
    }

    /// What clips `view`: each of its superviews that clips, by what it shows in the window.
    @MainActor
    static func clips(of view: UIView?, in window: UIWindow) -> [CGRect] {
      sequence(first: view?.superview) { $0?.superview }.compactMap { $0 }
        .filter { $0.clipsToBounds || $0 is UIScrollView }
        .map { holder in
          let shown =
            holder is UIScrollView ? holder.bounds.inset(by: holder.safeAreaInsets) : holder.bounds
          return holder.convert(shown, to: window)
        }
    }

    /// All of `rect` shows: inside the window's safe area and every view that clips it.
    func shows(_ rect: CGRect, clips: [CGRect]) -> Bool {
      ([window] + clips).allSatisfy { $0.insetBy(dx: -0.5, dy: -0.5).contains(rect) }
    }
  }

  /// The window as drawn, read only inside a known region: a mark's, an end's, or the room after a
  /// row where the system draws its chevron or accessory. It is also the capture's picture, so the
  /// picture is the frame that was measured. The system draws its status bar and home indicator
  /// outside the app's window, so the picture has neither.
  @MainActor
  private struct WindowPicture {
    let scale: CGFloat
    let png: Data?
    private let viewports: LayoutViewports
    private let window: UIWindow
    private let width: Int
    private let height: Int
    private let pixels: [UInt8]

    var pixelWidth: Int { width }
    var pixelHeight: Int { height }

    init(window: UIWindow) {
      let format = UIGraphicsImageRendererFormat(for: window.traitCollection)
      format.opaque = true
      let image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { _ in
        window.drawHierarchy(in: window.bounds, afterScreenUpdates: false)
      }

      scale = format.scale
      png = image.pngData()
      viewports = LayoutViewports(window: window)
      self.window = window

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

    /// Whether all of `rect` is on the screen, so its pixels are all of its ink: `host` is a view
    /// inside it, whose superviews are what can cut it.
    func shows(_ rect: CGRect, host: UIView?) -> Bool {
      viewports.shows(rect, clips: LayoutViewports.clips(of: host, in: window))
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

  extension UIWindow {
    /// The top screen's view: a screen under a sheet keeps its lists and scroll views in the window.
    var topScreen: UIView {
      var top = rootViewController
      while let presented = top?.presentedViewController, !presented.isBeingDismissed {
        top = presented
      }

      return top?.view ?? self
    }
  }

  enum LayoutHosts {
    /// A record counts while its view is in the window, and under a screen that covers the window,
    /// inside that screen: a view can leave the window, or stay under a cover, without
    /// `onDisappear`. A view drawn into a picture never has a host and keeps its record.
    @MainActor
    static func isOnScreen(_ host: UIView?, hosted: Bool, in window: UIWindow, top: UIView)
      -> Bool
    {
      guard hosted else { return true }
      guard let host, host.window === window else { return false }
      let covers = top.convert(top.bounds, to: window).contains(window.bounds)
      return !covers || host.isDescendant(of: top)
    }
  }

  /// The capture's summary: each part once, "not measured" when any of its fields is, when it is a
  /// list row no piece reports, or when no row holds it; groups, rows a piece declares and anchors
  /// aren't parts.
  enum LayoutCounts {
    static func of(_ elements: [[String: Any]]) -> [String: Int] {
      let parts = elements.filter { element in
        switch element["part"] as? String {
        case "group", "anchor": false
        case "row": element["ink"] as? String == "not measured"
        default: true
        }
      }

      let notMeasured = parts.filter { element in
        element["piece"] as? String == "unreported"
          || element.values.contains { $0 as? String == "not measured" }
      }.count

      return ["parts": parts.count - notMeasured, "notMeasured": notMeasured]
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
      /// The cell itself: its superviews are its list and what holds the list.
      let view: UIView
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
                contentEnd: frame.maxX - cell.layoutMargins.right,
                view: cell))
          }
        }

        view.subviews.forEach(visit)
      }

      visit(window.topScreen)
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

    init(picture: WindowPicture, cells: ListCells, window: UIWindow) {
      self.picture = picture
      self.cells = cells
      self.window = window
      let top = window.topScreen
      let shown = LayoutRegistry.shared.records
        .filter { !$0.value.frame.isNull && $0.value.frame.intersects(window.bounds) }
        .filter {
          LayoutHosts.isOnScreen(
            $0.value.host, hosted: $0.value.hosted, in: window, top: top)
        }
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

    /// A row as written: a declared row by its own identity, or a list cell holding parts that no
    /// declared row holds.
    private struct Row {
      let id: String
      let group: String
      let frame: CGRect
      let surface: UUID?
    }

    mutating func elements() -> [[String: Any]] {
      var out: [[String: Any]] = []
      var groupIDs: [String: String] = [:]
      var declaredRows: [UUID: Row] = [:]
      var cellRows: [String: Row] = [:]
      var rowsByCell: [String: [Row]] = [:]

      func cellKey(_ cell: ListCells.Cell) -> String {
        "\(cell.section):\(Int(cell.frame.minY))"
      }

      func group(_ key: String, piece: String, frames: [CGRect], endEdge: CGFloat, source: String?)
        -> String
      {
        if let id = groupIDs[key] { return id }
        let id = "g\(groupIDs.count)"
        groupIDs[key] = id
        let bounds = frames.reduce(CGRect.null) { $0.union($1) }
        var element: [String: Any] = [
          "id": id, "piece": piece, "part": "group", "group": NSNull(), "row": NSNull(),
          "bounds": Self.bounds(bounds), "ink": Self.bounds(bounds),
          "endEdge": Self.round(endEdge), "gap": 0,
        ]
        if let source {
          element["source"] = source
        }
        out.append(element)
        return id
      }

      func sectionGroup(_ cell: ListCells.Cell, piece: String) -> String {
        let inSection = cells.cells.filter { $0.section == cell.section }
        return group(
          cell.section, piece: piece, frames: inSection.map(\.frame),
          endEdge: inSection.map(\.contentEnd).max() ?? cell.frame.maxX, source: nil)
      }

      func addRow(
        _ row: Row, piece: String, bounds: CGRect, endEdge: CGFloat, flow: String, stacked: Bool,
        cell: ListCells.Cell?
      ) {
        var element: [String: Any] = [
          "id": row.id, "piece": piece, "part": "row", "group": row.group, "row": NSNull(),
          "bounds": Self.bounds(bounds), "ink": Self.bounds(row.frame), "flow": flow,
          "gapBefore": 0, "margins": [0, 0], "endEdge": Self.round(endEdge),
        ]
        if stacked {
          element["stacked"] = true
        }
        out.append(element)
        if let cell {
          rowsByCell[cellKey(cell), default: []].append(row)
        }
      }

      // Declared rows, inside a list's cells or not.
      let declared = records.compactMap { entry -> (UUID, LayoutRegistry.Record, LayoutPiece)? in
        guard case .row(let piece) = entry.record.kind else { return nil }
        return (entry.id, entry.record, piece)
      }
      let inCells = declared.map { cells.cell(containing: $0.1.frame) }
      let declaredPerCell = Dictionary(grouping: inCells.compactMap { $0.map(cellKey) }) { $0 }
        .mapValues(\.count)
      let outside = declared.indices.filter { inCells[$0] == nil }
      let stacks = LayoutStacks.groups(outside.map { declared[$0].1.frame })

      for (index, (id, record, piece)) in declared.enumerated() {
        guard let cell = inCells[index] else { continue }
        let groupID = sectionGroup(cell, piece: piece.rawValue)
        let row = Row(
          id: "\(groupID).r\(out.count)", group: groupID, frame: record.frame,
          surface: record.surface)
        declaredRows[id] = row
        // A cell with one declared row is that row; nested rows in a cell keep their own frames.
        let alone = declaredPerCell[cellKey(cell)] == 1
        addRow(
          row, piece: piece.rawValue, bounds: alone ? cell.frame : record.frame,
          endEdge: cell.contentEnd, flow: cell.section, stacked: record.stacked, cell: cell)
      }

      for (stackIndex, members) in stacks.enumerated() {
        let rows = members.map { declared[outside[$0]] }
        let frames = rows.map(\.1.frame)
        let key = "stack\(stackIndex)"
        let groupID = group(
          key, piece: rows[0].2.rawValue, frames: frames,
          endEdge: frames.map(\.maxX).max() ?? 0, source: "stack")

        for (id, record, piece) in rows {
          let row = Row(
            id: "\(groupID).r\(out.count)", group: groupID, frame: record.frame,
            surface: record.surface)
          declaredRows[id] = row
          addRow(
            row, piece: piece.rawValue, bounds: record.frame, endEdge: record.frame.maxX,
            flow: key, stacked: record.stacked, cell: nil)
        }
      }

      /// A part's row: its declared row, else a declared row level with it in its cell or on its
      /// surface (a chevron a modifier puts beside the row), else its cell.
      func rowOf(_ record: LayoutRegistry.Record) -> Row? {
        if let id = record.row, let row = declaredRows[id] { return row }

        let center = CGPoint(x: record.frame.midX, y: record.frame.midY)
        let level = { (row: Row) in row.frame.minY <= center.y && center.y <= row.frame.maxY }

        guard let cell = cells.cell(containing: record.frame) else {
          return declaredRows.values
            .filter { $0.surface == record.surface && level($0) && $0.frame.minX <= center.x }
            .min { abs($0.frame.maxX - center.x) < abs($1.frame.maxX - center.x) }
        }

        if let row = rowsByCell[cellKey(cell)]?.filter(level).min(by: {
          $0.frame.height < $1.frame.height
        }) {
          return row
        }

        let key = cellKey(cell)
        if let row = cellRows[key] { return row }
        let groupID = sectionGroup(cell, piece: LayoutPiece.listGroup.rawValue)
        let row = Row(
          id: "\(groupID).r\(out.count)", group: groupID, frame: cell.frame,
          surface: record.surface)
        cellRows[key] = row
        addRow(
          row, piece: LayoutPiece.listGroup.rawValue, bounds: cell.frame,
          endEdge: cell.contentEnd, flow: cell.section, stacked: false, cell: cell)
        return row
      }

      let surfaces = surfaces
      var seenParts = Set<String>()

      for (index, (id, record)) in records.enumerated() {
        switch record.kind {
        case .part(let part):
          // A view drawn twice at one place, such as one an accessibility representation repeats,
          // is one drawing of the part.
          let key = "\(part):\(record.row?.uuidString ?? ""):\(record.frame)"
          guard part == .end || part == .mark || !isEndGlyph(record),
            seenParts.insert(key).inserted
          else { continue }
          var element = part == .end ? endElement(record) : partElement(part, id, record)
          element["id"] = "p\(index)"

          if let row = rowOf(record) {
            element["id"] = "\(row.id).p\(index)"
            element["group"] = row.group
            element["row"] = row.id
            element["piece"] = out.first { $0["id"] as? String == row.group }?["piece"]
          } else {
            // Never dropped: a part no row holds is written, and counted as not measured.
            element["group"] = NSNull()
            element["row"] = NSNull()
            element["piece"] = "unreported"
            element["name"] = "a part outside any row"
          }
          out.append(element)
        case .action(let variant):
          // Only a main action's fill counts; another look is written only as a pair's anchor.
          guard variant == "filled" || record.anchor != nil else { continue }
          let surface = record.surface.flatMap { surfaces[$0] } ?? "page"
          var element: [String: Any] = [
            "id": "a\(index)", "piece": "action", "part": variant == "filled" ? "action" : "anchor",
            "group": NSNull(), "row": NSNull(), "bounds": Self.bounds(record.frame),
            "ink": Self.bounds(record.frame), "variant": variant, "surface": surface,
          ]
          if let anchor = record.anchor {
            element["anchor"] = "\(surface)/\(anchor).\(variant)"
          }
          if record.disabled {
            element["disabled"] = true
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

      let systemEnds = systemEnds(rowsByCell: rowsByCell, cellKey: cellKey)
      out.append(contentsOf: systemEnds)
      out.append(
        contentsOf: unreportedRows(
          reported: Set(rowsByCell.keys), groups: groupIDs, cellKey: cellKey))

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
    /// What can't be read says "not measured" in its own field.
    private mutating func partElement(
      _ part: LayoutPart, _ id: UUID, _ record: LayoutRegistry.Record
    ) -> [String: Any] {
      var element: [String: Any] = ["part": part.rawValue, "bounds": Self.bounds(record.frame)]

      if part == .mark {
        guard picture.shows(record.frame, host: record.host) else { return clipped(element) }
        element["ink"] = picture.ink(in: record.frame).map(Self.bounds) ?? NSNull()
        return element
      }

      element["text"] = record.text.flatMap(Self.words)

      // The layout's baseline and capitals hold off screen too; what was drawn there doesn't show.
      if picture.shows(record.frame, host: record.host) {
        element["ink"] = Self.bounds(record.frame)
      } else {
        element["ink"] = "not measured"
        element["clipped"] = true
      }

      guard let baseline = record.baseline,
        let style = record.styles
          .filter({ $0.rect.minY - 0.5 <= baseline && baseline <= $0.rect.maxY + 0.5 })
          .min(by: { $0.rect.width * $0.rect.height < $1.rect.width * $1.rect.height })?.style
          ?? record.inherited
      else {
        element["baseline"] = "not measured"
        element["capTop"] = "not measured"
        element["capBottom"] = "not measured"
        element["type"] = "not measured"
        return element
      }

      let font = style.uiFont(record.dynamicTypeSize, legibility: record.legibility)
      let drawn = LayoutRuns.shared.lines(of: id)
      element["baseline"] = Self.round(baseline)
      element["type"] = style.layoutName

      if LayoutFaces.drewOnly(font, drawn) {
        element["capTop"] = Self.round(baseline - font.capHeight * record.scale)
        element["capBottom"] = Self.round(baseline)
        element["firstLine"] = Self.bounds(
          CGRect(
            x: record.frame.minX, y: record.frame.minY, width: record.frame.width,
            height: baseline - font.descender * record.scale - record.frame.minY))
      } else {
        // Another face drew some of it (a script or an emoji the font lacks, another font), or
        // nothing showed what drew it: the font's capitals aren't the drawn ones.
        element["capTop"] = "not measured"
        element["capBottom"] = "not measured"
      }

      if part == .label {
        let spacing = style.layoutLineSpacing(font)
        let height = record.frame.height / record.scale
        element["lines"] =
          drawn.map(\.lines).max()
          ?? max(1, Int(((height + spacing) / (font.lineHeight + spacing)).rounded()))
      }

      if let role = record.role {
        element["role"] = role.rawValue
      }

      return element
    }

    /// An end the piece draws: its ink, or a holder when it keeps the room and draws nothing.
    private mutating func endElement(_ record: LayoutRegistry.Record) -> [String: Any] {
      guard picture.shows(record.frame, host: record.host) else {
        return clipped(["part": "end", "bounds": Self.bounds(record.frame)])
      }

      // A turned glyph draws past its frame.
      guard let ink = picture.ink(in: record.frame.insetBy(dx: -2, dy: -2)) else {
        return [
          "part": "holder", "bounds": Self.bounds(record.frame), "ink": NSNull(),
          "name": "the chevron's kept slot",
        ]
      }

      return ["part": "end", "bounds": Self.bounds(record.frame), "ink": Self.bounds(ink)]
    }

    /// A part read from pixels that the screen's edge cuts: its ink can't be told from the picture.
    private mutating func clipped(_ element: [String: Any]) -> [String: Any] {
      var element = element
      element["ink"] = "not measured"
      element["clipped"] = true
      return element
    }

    /// What the system draws after a row's content (a link's chevron, a checkmark), read from the
    /// picture between the content's end and the cell's. SwiftUI draws it inside the cell's own
    /// view, so the room is all that says it's there: a row wholly on screen with nothing in it has
    /// none; a row cut by what holds it, or one that can't be read, has its end "not measured". The
    /// room is read on the right only, so a right-to-left row's end is "not measured" (no language
    /// the app ships is right to left).
    private mutating func systemEnds(
      rowsByCell: [String: [Row]], cellKey: (ListCells.Cell) -> String
    ) -> [[String: Any]] {
      cells.cells.compactMap { cell in
        guard let rows = rowsByCell[cellKey(cell)], !rows.isEmpty else { return nil }

        let contentEnd = records.filter {
          if case .part = $0.record.kind {
            return cell.frame.contains(CGPoint(x: $0.record.frame.midX, y: $0.record.frame.midY))
          }
          return false
        }.map(\.record.frame.maxX).max()

        guard let contentEnd else { return nil }

        let room = CGRect(
          x: contentEnd + 1, y: cell.frame.minY + 1, width: cell.contentEnd - contentEnd + 1,
          height: cell.frame.height - 2)
        let read = LayoutSystemEnd.read(
          room: room, shown: picture.shows(cell.frame, host: cell.view),
          ink: picture.ink(in: room),
          rightToLeft: cell.view.effectiveUserInterfaceLayoutDirection == .rightToLeft)

        let row =
          rows.first { $0.frame.minY <= cell.frame.midY && cell.frame.midY <= $0.frame.maxY }
          ?? rows[0]
        var element: [String: Any] = [
          "id": "\(row.id).system", "piece": LayoutPiece.listGroup.rawValue, "part": "end",
          "group": row.group, "row": row.id,
          "name": "drawn by the system after the row (from the picture)", "source": "picture",
        ]

        switch read {
        case .none:
          return nil
        case .glyph(let ink):
          element["bounds"] = Self.bounds(ink)
          element["ink"] = Self.bounds(ink)
        case .unreadable(let clipped):
          element["bounds"] = Self.bounds(room)
          element["ink"] = "not measured"
          if clipped {
            element["clipped"] = true
          }
        case .mirrored:
          element["bounds"] = Self.bounds(cell.frame)
          element["ink"] = "not measured"
          element["reason"] = "right to left: the room is read on the right only"
        }

        return element
      }
    }

    /// List rows no shared piece reports: written so they count, never guessed at.
    /// In a group with measured rows, they stay its neighbors, so a gap is read between rows that
    /// really are next to each other.
    private mutating func unreportedRows(
      reported: Set<String>, groups: [String: String], cellKey: (ListCells.Cell) -> String
    ) -> [[String: Any]] {
      cells.cells.filter { !reported.contains(cellKey($0)) }.enumerated().map { index, cell in
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

  /// What the room after a list row's content holds.
  enum LayoutSystemEnd: Equatable {
    /// Nothing: no room for an accessory, or nothing drawn there.
    case none
    /// A glyph, such as a chevron or a checkmark.
    case glyph(CGRect)
    /// Something is drawn there that can't be read as one glyph, or the row is cut, so whether it
    /// has one can't be told.
    case unreadable(clipped: Bool)
    /// A right-to-left row, whose end the right-side read doesn't see.
    case mirrored

    /// `shown`: the whole row is on screen.
    static func read(room: CGRect, shown: Bool, ink: CGRect?, rightToLeft: Bool = false)
      -> LayoutSystemEnd
    {
      guard !rightToLeft else { return .mirrored }
      guard shown else { return .unreadable(clipped: true) }
      // A scroll indicator's sliver isn't an accessory.
      guard room.width > 1, let ink, ink.width >= 3 else { return .none }
      // Larger than one glyph: the accessory runs into something else.
      guard ink.width <= 24, ink.height <= 24 else { return .unreadable(clipped: false) }
      return .glyph(ink)
    }
  }

  /// Declared rows outside a list, grouped as a list would group them: rows of one width and start
  /// that touch, top to bottom.
  enum LayoutStacks {
    /// The indexes of `frames`, one array per group.
    static func groups(_ frames: [CGRect]) -> [[Int]] {
      var groups: [[Int]] = []

      for index in frames.indices.sorted(by: { frames[$0].minY < frames[$1].minY }) {
        let frame = frames[index]

        if let last = groups.last?.last.map({ frames[$0] }),
          abs(last.minX - frame.minX) <= 0.5, abs(last.width - frame.width) <= 0.5,
          (-0.5...1).contains(frame.minY - last.maxY)
        {
          groups[groups.count - 1].append(index)
        } else {
          groups.append([index])
        }
      }

      return groups
    }
  }

  enum LayoutFaces {
    /// Whether `font` drew every text's first line: each of its runs has the font's ascent. A run
    /// a fallback face drew (a script or an emoji the font lacks) or another font has its own.
    static func drewOnly(_ font: UIFont, _ lines: [DrawnLine]) -> Bool {
      !lines.isEmpty
        && lines.allSatisfy { line in
          !line.ascents.isEmpty && line.ascents.allSatisfy { abs($0 - font.ascender) < 0.05 }
        }
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
