import SwiftUI
import UIKit

extension View {
  /// Main's `BottomBar`: the one home of a screen's main action, pinned at the bottom in a
  /// `safeAreaBar` on the page's background under a hairline, so content scrolls out of sight under
  /// it and never shows through its see-through outline buttons. Its buttons are 44pt,
  /// 8pt apart in one row, the main action last and taking the room the others leave; when they
  /// don't fit one row, or at an accessibility text size, they stack, each as wide as the bar. On a wide bar the main action sits
  /// at the bar's end at its own width instead. Its one line (`note`) floats over the screen just
  /// above the bar, so the bar and its buttons never move when it shows.
  func bottomBar<Actions: View>(
    note: BarNote? = nil, @ViewBuilder _ actions: () -> Actions
  ) -> some View {
    modifier(BottomBarPlacement(bar: BottomBar(note: note, actions: actions())))
  }
}

/// Reads the screen's readable columns for the bar.
private struct BottomBarPlacement<Actions: View>: ViewModifier {
  let bar: BottomBar<Actions>

  @State private var columns: [ColumnMargins] = []

  func body(content: Content) -> some View {
    content
      .announcesStatus(bar.note?.politeLine)
      .onPreferenceChange(ColumnMarginsKey.self) { columns = $0 }
      .safeAreaBar(edge: .bottom) {
        bar.environment(\.barColumn, columns.count == 1 ? columns.first : nil)
      }
      // A soft edge would fade the page above the bar's hairline, over the backing it ends at.
      .scrollEdgeEffectStyle(.hard, for: .bottom)
  }
}

extension EnvironmentValues {
  @Entry fileprivate var barColumn: ColumnMargins?
}

private struct BottomBar<Actions: View>: View {
  let note: BarNote?
  let actions: Actions

  @Environment(\.barColumn) private var column
  @Environment(\.isTaskScreen) private var isTask

  @Environment(\.stacksContent) private var isStacked
  /// The bar's own width: a page beside another (an iPad's lesson spread) is as narrow as a phone,
  /// whatever the window's size class says.
  @State private var width: CGFloat = 0
  /// The margins a list's rows sit in, so over a list the buttons end where the rows do.
  @State private var listMargins: NSDirectionalEdgeInsets?

  var body: some View {
    // A bar whose buttons all hide draws nothing, so it takes no room under the content.
    Group(subviews: actions) { buttons in
      if !buttons.isEmpty || note != nil {
        bar(buttons)
      }
    }
  }

  private func bar(_ buttons: SubviewsCollection) -> some View {
    // Wide, a filling button would read as a banner across the page.
    let isWide = width >= WideBar.width && !isStacked

    return Group {
      if isWide || isStacked || buttons.count < 2 {
        AccessibilityStack(spacing: 8) {
          buttons
        }
        // A lone button on a phone takes the whole row, as the main action does beside others.
        .buttonSizing(isStacked || (buttons.count == 1 && !isWide) ? .flexible : .automatic)
      } else {
        // Main's bar: a second action too long to share the row ("Ich weiß es noch nicht") sits on
        // its own line above the main action, and is read first, as drawn.
        ViewThatFits(in: .horizontal) {
          HStack(spacing: 8) {
            actions
          }
          .buttonSizing(.automatic)

          VStack(spacing: 8) {
            actions
          }
          .buttonSizing(.flexible)
        }
      }
    }
    .controlSize(.large)
    .layoutAnchor("bar")
    .environment(\.mainActionFillsRow, !isWide)
    .environment(\.mainActionMinWidth, isWide ? WideBar.mainActionMinWidth : nil)
    .frame(maxWidth: .infinity, alignment: isWide ? .trailing : .center)
    .onGeometryChange(for: CGFloat.self) {
      $0.size.width
    } action: {
      width = $0
    }
    .barColumn(column, listMargins: listMargins, isTask: isTask)
    .scenePadding(.vertical)
    .background(ListMarginsReader { listMargins = $0 })
    .keepsOffFold()
    // Main's bar: the page's background from its hairline to the screen's edge. The system's edge
    // effect alone leaves a list's section header sharp under the buttons, drawn above it.
    .background {
      Color(.background)
        .overlay(alignment: .top) {
          if note == nil { Divider() }
        }
        .ignoresSafeArea(edges: .bottom)
    }
    // Main's note is the bar's own top: its hairline moves above the note, which lines up with
    // the buttons.
    .floatingAbove {
      if let note {
        note
          .typeStyle(.body)
          .frame(maxWidth: .infinity)
          .barColumn(column, listMargins: listMargins, isTask: isTask)
          .padding(.top, 12)
          .padding(.bottom, 4)
          .background {
            Color(.background)
              .overlay(alignment: .top) { Divider() }
          }
      }
    }
  }
}

extension View {
  /// `content` over the screen, its bottom on this view's top edge, so this view never moves when
  /// it shows.
  func floatingAbove<Above: View>(@ViewBuilder _ content: () -> Above) -> some View {
    overlay(alignment: .top) {
      Color.clear
        .frame(height: 0)
        .overlay(alignment: .bottom) {
          content()
            .fixedSize(horizontal: false, vertical: true)
        }
    }
  }
}

/// A bar from main's `sm` (less the scene's margins) puts its main action at its end, at least
/// this wide.
enum WideBar {
  static let width: CGFloat = 600
  static let mainActionMinWidth: CGFloat = 160
}

extension EnvironmentValues {
  /// In a narrow bottom bar, the main action takes the room its row's other buttons
  /// leave.
  @Entry var mainActionFillsRow = false
  /// In a wide bottom bar, the main action's least width.
  @Entry var mainActionMinWidth: CGFloat?
}

/// A bottom bar's one line over its buttons: what a tap couldn't do, or a status the screen waits on
/// (muted), with at most one small action such as "Retry". As main's bar, whose note sits in a live
/// region that stays on screen, VoiceOver reads a status as it shows, but not one the screen opens
/// with.
struct BarNote: View {
  enum Tone {
    /// Read out at once, over what VoiceOver is saying.
    case failure
    case status
    /// A failure the screen is still working through, such as an answer being sent again: drawn as
    /// a failure, read as a status.
    case waiting
  }

  struct Action {
    let label: Text
    var isEnabled = true
    let perform: () -> Void
  }

  private let heading: AttributedString?
  private let message: AttributedString
  let tone: Tone
  let action: Action?

  init(_ message: LocalizedStringResource, tone: Tone = .failure, action: Action? = nil) {
    self.init(nil, AttributedString(localized: message), tone: tone, action: action)
  }

  /// For words already localized, such as a server's message.
  init(_ message: String, tone: Tone = .failure, action: Action? = nil) {
    self.init(nil, AttributedString(message), tone: tone, action: action)
  }

  /// A status the screen waits on, said in a line and what to do about it.
  init(heading: LocalizedStringResource, _ message: LocalizedStringResource) {
    self.init(
      AttributedString(localized: heading), AttributedString(localized: message), tone: .status,
      action: nil)
  }

  private init(
    _ heading: AttributedString?, _ message: AttributedString, tone: Tone, action: Action?
  ) {
    self.heading = heading
    self.message = message
    self.tone = tone
    self.action = action
  }

  /// What the bar reads politely as this note shows or changes; a failure reads itself at once.
  var politeLine: String? {
    guard tone != .failure else { return nil }
    return [heading, message].compactMap { $0.map { String($0.characters) } }.joinedSentences()
  }

  var body: some View {
    if let heading {
      GateWords(title: Text(heading), line: Text(message))
    } else {
      line
    }
  }

  private var line: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      switch tone {
      case .failure:
        FailureLine(message: message)
      case .status:
        Text(message)
          .foregroundStyle(.mutedForeground)
      case .waiting:
        Text(message)
          .foregroundStyle(.destructiveText)
      }

      if let action {
        Button(action: action.perform) {
          action.label
        }
        .buttonStyle(.outline)
        .controlSize(.small)
        .disabled(!action.isEnabled)
      }
    }
    .multilineTextAlignment(action == nil ? .center : .leading)
  }
}

extension View {
  /// The bar lines up with the screen's one readable column, such as a list's 768pt one on iPad,
  /// so its buttons and its note end where the rows do; without one it keeps main's 680pt task
  /// column. Only the sides: the buttons add the scene's room above and below.
  @ViewBuilder
  fileprivate func barColumn(
    _ column: ColumnMargins?, listMargins: NSDirectionalEdgeInsets?, isTask: Bool
  ) -> some View {
    if let column {
      // A list's rows sit in the system's margins inside its column (20pt on a wide phone), not
      // the scene's padding (16pt).
      if let listMargins {
        padding(.leading, column.leading + listMargins.leading)
          .padding(.trailing, column.trailing + listMargins.trailing)
      } else {
        padding(.leading, column.leading)
          .padding(.trailing, column.trailing)
          .scenePadding(.horizontal)
      }
    } else if isTask {
      frame(maxWidth: 680)
        .frame(maxWidth: .infinity)
        .scenePadding(.horizontal)
    } else {
      // A page without a list, such as an empty state, keeps the page's column, where its list
      // would end.
      padding(.leading, listMargins?.leading ?? 16)
        .padding(.trailing, listMargins?.trailing ?? 16)
        .pageColumnFrame()
    }
  }

  /// Main's task column: at most 680pt wide, centered on the screen, inside the scene's margins.
  func taskColumn(alignment: Alignment = .center) -> some View {
    frame(maxWidth: 680, alignment: alignment)
      .frame(maxWidth: .infinity)
      .scenePadding()
  }
}

/// The system's least margins for a screen's content, the ones a list lays its rows in, read from
/// the controller that holds the bar as they change with the width.
private struct ListMarginsReader: UIViewRepresentable {
  let report: (NSDirectionalEdgeInsets) -> Void

  func makeUIView(context: Context) -> MarginsView {
    let view = MarginsView()
    view.report = report
    view.isUserInteractionEnabled = false
    return view
  }

  func updateUIView(_ view: MarginsView, context: Context) {
    view.report = report
  }

  final class MarginsView: UIView {
    var report: ((NSDirectionalEdgeInsets) -> Void)?
    private var reported: NSDirectionalEdgeInsets?

    override func layoutSubviews() {
      super.layoutSubviews()

      // The controller that holds the bar, such as a sheet's, whose margins can be narrower than the
      // window's.
      var responder: UIResponder? = self
      while let next = responder, !(next is UIViewController) { responder = next.next }

      guard
        let margins = (responder as? UIViewController ?? window?.rootViewController)?
          .systemMinimumLayoutMargins,
        margins != reported
      else { return }

      reported = margins
      // Reported after layout, so a margin change lays the bar out once more, not within this pass.
      DispatchQueue.main.async { [report] in report?(margins) }
    }
  }
}
