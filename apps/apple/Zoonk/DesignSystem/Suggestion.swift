import SwiftUI

/// Main's `SuggestionMark`: a suggestion's own mark is muted; one without (an offer of more lessons
/// or of more time) takes the warning sparkle.
struct SuggestionMark: View {
  enum Kind {
    case sparkle
    case done
    /// In the done mark's place on a line whose save failed.
    case alert
    case symbol(String)
  }

  let kind: Kind

  var body: some View {
    switch kind {
    case .sparkle:
      Image(systemName: "sparkle")
        .foregroundStyle(.warning)
    case .done:
      StatusMark(status: .done)
    case .alert:
      Image(systemName: "exclamationmark.circle")
        .foregroundStyle(.destructiveText)
        .accessibilityLabel(Text(SuggestionSaveError.message))
    case .symbol(let name):
      Image(systemName: name)
        .foregroundStyle(.mutedForeground)
    }
  }
}

/// Main's `SuggestionLine`: a panel with the suggestion's mark, its title in two lines at most, and
/// its small action at its end, or under the title when the action would leave it less than half
/// the line; stacked, the whole title and the action under it.
struct SuggestionLine<Mark: View, Summary: View, Action: View>: View {
  @Environment(\.stacksContent) private var isStacked

  var alignment = VerticalAlignment.center

  @ViewBuilder let mark: Mark
  @ViewBuilder let summary: Summary
  @ViewBuilder let action: Action

  var body: some View {
    // Stacked, two lines of large text say too little, so the summary wraps whole and the action
    // goes under it.
    SuggestionLineLayout(isStacked: isStacked) {
      HStack(alignment: isStacked ? .firstTextBaseline : alignment, spacing: 10) {
        mark
          .accessibilityHidden(true)

        summary
          .typeStyle(.body)
          .lineLimit(isStacked ? nil : 2)
          .frame(maxWidth: .infinity, alignment: .leading)
      }

      // One part however many views the action is, and none at all.
      HStack(spacing: 8) {
        action
      }
      .labelStyle(SuggestionLineLabelStyle())
    }
    // The same room on every side, as main's card: the mark sits as far from its edge as the
    // action from its own.
    .padding(8)
    .frame(minHeight: 48)
    .panel()
  }
}

/// The summary, then the action: beside it while the action leaves it half the line, its buttons
/// keeping their words whole; under it otherwise, as when content stacks.
private struct SuggestionLineLayout: Layout {
  let isStacked: Bool

  private static let besideSpacing: CGFloat = 10
  private static let underSpacing: CGFloat = 8

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    guard let (lead, action) = parts(subviews) else { return .zero }

    if let actionSize = besideActionSize(proposal.width, action) {
      let actionWidth = besideWidth(actionSize)
      let width = proposal.width.map { $0 - actionWidth }
      let leadSize = lead.sizeThatFits(ProposedViewSize(width: width, height: nil))
      return CGSize(
        width: proposal.width ?? leadSize.width + actionWidth,
        height: max(leadSize.height, actionSize.height))
    }

    let under = ProposedViewSize(width: proposal.width, height: nil)
    let leadSize = lead.sizeThatFits(under)
    let actionSize = action.sizeThatFits(under)
    return CGSize(
      width: proposal.width ?? max(leadSize.width, actionSize.width),
      height: leadSize.height + underSpacing(actionSize) + actionSize.height)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    guard let (lead, action) = parts(subviews) else { return }

    if let actionSize = besideActionSize(bounds.width, action) {
      let leadWidth = bounds.width - besideWidth(actionSize)
      lead.place(
        at: CGPoint(x: bounds.minX, y: bounds.midY), anchor: .leading,
        proposal: ProposedViewSize(width: leadWidth, height: nil))
      action.place(
        at: CGPoint(x: bounds.maxX, y: bounds.midY), anchor: .trailing,
        proposal: ProposedViewSize(actionSize))
      return
    }

    let under = ProposedViewSize(width: bounds.width, height: nil)
    let leadHeight = lead.sizeThatFits(under).height
    let spacing = underSpacing(action.sizeThatFits(under))
    lead.place(at: bounds.origin, proposal: under)
    action.place(
      at: CGPoint(x: bounds.minX, y: bounds.minY + leadHeight + spacing), proposal: under)
  }

  private func parts(_ subviews: Subviews) -> (LayoutSubview, LayoutSubview)? {
    subviews.count == 2 ? (subviews[0], subviews[1]) : nil
  }

  /// The action's own size when it goes beside the summary.
  private func besideActionSize(_ width: CGFloat?, _ action: LayoutSubview) -> CGSize? {
    guard !isStacked else { return nil }
    let size = action.sizeThatFits(.unspecified)
    guard let width else { return size }
    return besideWidth(size) <= width / 2 ? size : nil
  }

  private func underSpacing(_ action: CGSize) -> CGFloat {
    action.height > 0 ? Self.underSpacing : 0
  }

  /// What the action takes from the summary's width: nothing when there's none.
  private func besideWidth(_ action: CGSize) -> CGFloat {
    action.width > 0 ? action.width + Self.besideSpacing : 0
  }
}

/// A list row would set a button's icon in its own column, far from its words.
private struct SuggestionLineLabelStyle: LabelStyle {
  func makeBody(configuration: Configuration) -> some View {
    HStack(spacing: 6) {
      configuration.icon
        .accessibilityHidden(true)
      configuration.title
    }
  }
}

/// Main's `SuggestionOpen`: "View", which opens the whole suggestion in a sheet, its answers
/// ending the sheet in its bottom bar. An answer that replaces the line takes the button away, and
/// the sheet closes with it. `isOpen` keeps it open across a fold where the screen owns that state.
struct SuggestionOpen<Content: View, Actions: View>: View {
  var isOpen: Binding<Bool>?
  var note: BarNote?
  /// What opening it leads to, where "View" would say less, such as the exam card's.
  var label: Text?
  /// Runs once the sheet is gone, so a choice made in it can open another sheet.
  var onDismiss: (() -> Void)?
  @ViewBuilder let content: Content
  @ViewBuilder let actions: Actions

  @State private var isOpenHere = false

  private var shown: Binding<Bool> { isOpen ?? $isOpenHere }

  var body: some View {
    SuggestionViewButton(label: label) {
      shown.wrappedValue = true
    }
    .sheet(isPresented: shown, onDismiss: onDismiss) {
      SuggestionSheet {
        SuggestionSheetBody(note: note) {
          content
        } actions: {
          actions
        }
      }
      .zoonkSheet()
    }
  }
}

/// `SuggestionOpen`'s "View", for a screen that presents the sheet itself, above panes that a
/// resize or a fold rebuilds.
struct SuggestionViewButton: View {
  var label: Text?
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      label ?? Text("View", tableName: "Plan", comment: "Opens the Plan's suggestion in full")
    }
    .buttonStyle(.outline)
    .controlSize(.small)
  }
}

/// `SuggestionOpen`'s sheet: the whole suggestion, closed with its close button or by any place
/// opened from it, such as a finished plan's next course. Its content is a `SuggestionSheetBody`, so
/// it ends the way the app's other sheets do.
struct SuggestionSheet<Content: View>: View {
  @Environment(\.dismiss) private var dismiss

  @ViewBuilder let content: Content

  var body: some View {
    NavigationStack {
      content
        .environment(\.isInSuggestionSheet, true)
        .sheetClose { dismiss() }
    }
    .presentationDetents([.medium, .large])
    .closesOnNavigation()
  }
}

/// A suggestion's sheet: its words scroll and its answers are the sheet's bottom bar, the main one
/// last, as the app's other sheets end. A failed answer is the bar's line.
struct SuggestionSheetBody<Content: View, Actions: View>: View {
  var note: BarNote?
  @ViewBuilder let content: Content
  @ViewBuilder let actions: Actions

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 8) {
        content
      }
      .controlSize(.large)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding()
    }
    .bottomBar(note: note) {
      actions
    }
  }
}

extension SuggestionSheetBody where Actions == EmptyView {
  init(@ViewBuilder content: () -> Content) {
    self.init(content: content) {
      EmptyView()
    }
  }
}

extension SuggestionOpen where Actions == EmptyView {
  init(isOpen: Binding<Bool>? = nil, @ViewBuilder content: () -> Content) {
    self.init(isOpen: isOpen, content: content) {
      EmptyView()
    }
  }
}

/// Main's `SuggestionActions`: a suggestion's answers by role. On the page they start with the main
/// one, right after the question; its sheet ends with it, as every sheet's bar does.
struct SuggestionActions<Main: View, Other: View>: View {
  @Environment(\.isInSuggestionSheet) private var isInSheet

  @ViewBuilder let main: Main
  /// The other answer, or "Other options".
  @ViewBuilder let other: Other

  var body: some View {
    if isInSheet {
      other
      main
    } else {
      main
      other
    }
  }
}

extension EnvironmentValues {
  /// Inside a suggestion's sheet, where a suggestion's card draws the whole `SuggestionSheetBody`.
  @Entry var isInSuggestionSheet = false
  /// What failed in that sheet, for its bar's line.
  @Entry var suggestionSheetNote: BarNote?
}

/// Main's `SuggestionSaveError`: an answer or its Undo didn't save. It sits with the buttons that
/// made it, in the sheet when they're there, and VoiceOver hears it as it appears.
struct SuggestionSaveError: View {
  static let message = LocalizedStringResource(
    "That didn't save. Try again.", table: "Plan",
    comment: "A plan suggestion's change or its Undo didn't save; trying again may work")

  var body: some View {
    Text(Self.message)
      .typeStyle(.note)
      .foregroundStyle(.destructiveText)
      .announcesAlert(String(localized: Self.message))
  }
}
