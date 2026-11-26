import SwiftUI
import UIKit

extension View {
  /// Main's `BottomBar`: the one home of a screen's main action, pinned at the bottom in a
  /// `safeAreaBar` on the page's background under a hairline, so content scrolls out of sight under
  /// it and never shows through its see-through outline buttons. Its buttons are 44pt,
  /// 8pt apart, the main action last (or followed only by a task's Ask) and taking the room the
  /// others leave on its line (`BarLines`). On a wide bar the row sits at the bar's end, the main action at
  /// its own width instead. Its one line (`note`) floats over the screen just
  /// above the bar, so the bar and its buttons never move when it shows.
  func bottomBar<Actions: View>(
    note: BarNote? = nil, @ViewBuilder _ actions: () -> Actions
  ) -> some View {
    modifier(BottomBarPlacement(note: note, actions: actions()))
  }
}

/// Reads the screen's readable columns for the bar.
private struct BottomBarPlacement<Actions: View>: ViewModifier {
  let note: BarNote?
  let actions: Actions

  @Environment(\.stacksContent) private var isStacked
  @Environment(\.isTaskScreen) private var isTask
  @State private var columns: [ColumnMargins] = []
  @State private var width: CGFloat = 0
  @State private var listMargins: NSDirectionalEdgeInsets?

  private var column: ColumnMargins? { columns.count == 1 ? columns.first : nil }
  private var isWide: Bool { width >= WideBar.width && !isStacked }

  func body(content: Content) -> some View {
    content
      .barNote(note) {
        $0.barNoteLines(isWide: isWide).barColumn(column, listMargins: listMargins, isTask: isTask)
      }
      .onPreferenceChange(ColumnMarginsKey.self) { columns = $0 }
      .safeAreaBar(edge: .bottom) {
        Group(subviews: actions) { buttons in
          // A bar whose buttons all hide takes no room unless it has a note.
          if !buttons.isEmpty || note != nil {
            bar(buttons)
          }
        }
      }
      // A soft edge would fade the page above the bar's hairline, over the backing it ends at.
      .scrollEdgeEffectStyle(.hard, for: .bottom)
  }

  private func bar(_ buttons: SubviewsCollection) -> some View {
    // At accessibility sizes a bar stacks its buttons, except beside a way back, which keeps its row
    // with the main action under "I don't know yet", as main's does.
    let stacks = isStacked && !buttons.contains { $0.containerValues.isBarWayBack }

    return Group {
      if isWide || stacks || buttons.count < 2 {
        AccessibilityStack(spacing: 8) {
          buttons
        }
        // A lone button on a phone takes the whole row, as the main action does beside others.
        .buttonSizing(isStacked || (buttons.count == 1 && !isWide) ? .flexible : .automatic)
      } else {
        // Main's bar: a second action too long to share the row ("Ich weiß es noch nicht"), or
        // any beside a way back, sits on its own line above the main action.
        BarLines(spacing: 8) {
          actions
        }
        .buttonSizing(.flexible)
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
    .barBackdrop(hairline: note == nil)
  }
}

extension View {
  /// Main's bar note: it starts where the buttons do on a phone and ends with them on a wide bar.
  func barNoteLines(isWide: Bool) -> some View {
    typeStyle(.body)
      .multilineTextAlignment(isWide ? .trailing : .leading)
      .frame(maxWidth: .infinity, alignment: isWide ? .trailing : .leading)
  }

  /// A bar note's own room and backing, under the hairline that moves above it: one distance from
  /// the note to the buttons on every bar.
  func barNoteBackdrop() -> some View {
    padding(.top, 12)
      .padding(.bottom, 4)
      .background {
        Color(.background)
          .overlay(alignment: .top) { Divider() }
      }
  }
}

extension View {
  /// Main's bar: the page's background from its hairline to the screen's edge. The system's edge
  /// effect alone leaves a list's section header sharp under the buttons, drawn above it.
  func barBackdrop(hairline: Bool = true) -> some View {
    background {
      Color(.background)
        .overlay(alignment: .top) {
          if hairline { Divider() }
        }
        .ignoresSafeArea(edges: .bottom)
    }
  }

  /// The page's bottom overlay ends at the bar and can receive taps on note actions.
  func barNote(
    _ note: BarNote?,
    @ViewBuilder column: (BarNote) -> some View
  ) -> some View {
    overlay(alignment: .bottom) {
      if let note {
        column(note)
          .barNoteBackdrop()
      }
    }
    .announcesStatus(note?.politeLine)
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
    /// Drawn as a status but not read as it shows, such as the line while the learner records:
    /// VoiceOver's speech would end up in the recording.
    case hint
  }

  struct Action {
    let label: Text
    var isEnabled = true
    let perform: () -> Void
  }

  private let heading: AttributedString?
  private let message: AttributedString
  /// A note drawn by its own view, which reads out its own changes.
  private var content: AnyView?
  let tone: Tone
  let action: Action?

  init(_ message: LocalizedStringResource, tone: Tone = .failure, action: Action? = nil) {
    self.init(nil, AttributedString(localized: message), tone: tone, action: action)
  }

  /// For words already localized, such as a server's message.
  init(_ message: String, tone: Tone = .failure, action: Action? = nil) {
    self.init(nil, AttributedString(message), tone: tone, action: action)
  }

  init(heading: LocalizedStringResource, _ message: LocalizedStringResource) {
    self.init(
      AttributedString(localized: heading), AttributedString(localized: message), tone: .status,
      action: nil)
  }

  /// A note that changes on its own, such as a wait following its run.
  init(@ViewBuilder content: () -> some View) {
    self.init(nil, AttributedString(), tone: .status, action: nil)
    self.content = AnyView(content())
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
    guard [.status, .waiting].contains(tone), content == nil else { return nil }
    return [heading, message].compactMap { $0.map { String($0.characters) } }.joinedSentences()
  }

  var body: some View {
    if let content {
      content
    } else if let heading {
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
      case .status, .hint:
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
  }
}

extension View {
  /// The bar lines up with the screen's one readable column, such as a list's 768pt one on iPad,
  /// so both its note and actions end where the rows do.
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
