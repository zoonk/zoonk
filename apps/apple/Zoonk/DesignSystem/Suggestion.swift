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
        .foregroundStyle(.mutedForeground)
        .accessibilityLabel(Text(SuggestionSaveError.message))
    case .symbol(let name):
      Image(systemName: name)
        .foregroundStyle(.mutedForeground)
    }
  }
}

/// Main's `SuggestionHeader`: a suggestion's title alone, starting on the edge its lines and buttons
/// start on, the kind's mark staying with its line; at a sheet title's size in its sheet.
struct SuggestionHeader: View {
  @Environment(\.isInSuggestionSheet) private var isInSheet

  let title: Text

  init(_ title: Text) {
    self.title = title
  }

  var body: some View {
    title
      .typeStyle(isInSheet ? .sheetTitle : .note.weight(.semibold))
      .foregroundStyle(Color(.foreground))
      .accessibilityAddTraits(.isHeader)
  }
}

struct SuggestionResult: View {
  @Environment(\.isInSuggestionSheet) private var isInSheet

  let text: String

  var body: some View {
    Text(text)
      .typeStyle((isInSheet ? TypeStyle.sheetText : .note).weight(.medium))
      .foregroundStyle(Color(.foreground))
  }
}

/// A Today notice's bordered card. Its border is its edge, so its row adds no space around it and
/// the list's section gap alone sets it apart, as main's column gap does.
struct TodaySuggestionCard<Content: View>: View {
  var mark: SuggestionMark.Kind? = nil
  @ViewBuilder let content: Content

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 10) {
      if let mark {
        SuggestionMark(kind: mark)
          .accessibilityHidden(true)
      }

      VStack(alignment: .leading, spacing: 12) {
        content
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(14)
    .panel()
    .listRowSeparator(.hidden)
    .listRowInsets(.vertical, 0)
  }
}

/// Main's `SuggestionDescription`: what the title leaves to say, in the secondary color, at a
/// line's size in its line, at a sheet's reading size in its sheet, and at a row description's size
/// on the page.
struct SuggestionDescription<Content: View>: View {
  @Environment(\.isInSuggestionSheet) private var isInSheet
  @Environment(\.isInSuggestionLine) private var isInLine

  var color = Color.mutedForeground
  @ViewBuilder let content: Content

  var body: some View {
    content
      .typeStyle(isInSheet ? .sheetText : isInLine ? .note : .meta)
      .foregroundStyle(color)
  }
}

extension SuggestionDescription where Content == Text {
  init(_ text: Text, color: Color = .mutedForeground) {
    self.init(color: color) {
      text
    }
  }
}

/// Main's `SuggestionLine`: a panel with the suggestion's mark, its title in two lines at most, and
/// its small actions at its end, or under the title's words when they would leave it less than half
/// the line; stacked, the whole title and the actions under it.
struct SuggestionLine<Mark: View, Summary: View, Action: View>: View {
  @Environment(\.stacksContent) private var isStacked

  var alignment = VerticalAlignment.center

  @ViewBuilder let mark: Mark
  @ViewBuilder let summary: Summary
  @ViewBuilder let action: Action

  var body: some View {
    // Stacked, two lines of large text say too little, so the summary wraps whole and the action
    // goes under it.
    SuggestionLineLayout(
      isStacked: isStacked, alignment: isStacked ? .firstTextBaseline : alignment
    ) {
      // One part each, however many views they are, and none at all.
      HStack(spacing: 0) {
        mark
      }
      .accessibilityHidden(true)

      summary
        .typeStyle(.body)
        .lineLimit(isStacked ? nil : 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .environment(\.isInSuggestionLine, true)

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

/// The mark, the summary beside it, then the actions as one group: beside the summary while they
/// leave it half the room after the mark, their buttons keeping their words whole; under its words
/// otherwise, as when content stacks. The mark stays on the summary either way.
private struct SuggestionLineLayout: Layout {
  let isStacked: Bool
  let alignment: VerticalAlignment

  private static let markSpacing: CGFloat = 10
  private static let besideSpacing: CGFloat = 10
  private static let underSpacing: CGFloat = 8

  /// The mark and the summary at a width, the mark aligned to the summary by `alignment`.
  private struct Lead {
    let markOffset: CGPoint
    let summaryOffset: CGPoint
    let summaryProposal: ProposedViewSize
    let size: CGSize
  }

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    guard let (mark, summary, action) = parts(subviews) else { return .zero }
    let textWidth = proposal.width.map { $0 - markRoom(mark) }

    if let actionSize = besideActionSize(textWidth, action) {
      let lead = lead(mark, summary, textWidth: textWidth.map { $0 - besideWidth(actionSize) })
      return CGSize(
        width: proposal.width ?? lead.size.width + besideWidth(actionSize),
        height: max(lead.size.height, actionSize.height))
    }

    let lead = lead(mark, summary, textWidth: textWidth)
    let actionSize = action.sizeThatFits(ProposedViewSize(width: textWidth, height: nil))
    return CGSize(
      width: proposal.width ?? max(lead.size.width, markRoom(mark) + actionSize.width),
      height: lead.size.height + underSpacing(actionSize) + actionSize.height)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    guard let (mark, summary, action) = parts(subviews) else { return }
    let textWidth = bounds.width - markRoom(mark)

    if let actionSize = besideActionSize(textWidth, action) {
      let lead = lead(mark, summary, textWidth: textWidth - besideWidth(actionSize))
      place(lead, mark, summary, at: CGPoint(x: bounds.minX, y: bounds.midY - lead.size.height / 2))
      action.place(
        at: CGPoint(x: bounds.maxX, y: bounds.midY), anchor: .trailing,
        proposal: ProposedViewSize(actionSize))
      return
    }

    let lead = lead(mark, summary, textWidth: textWidth)
    let under = ProposedViewSize(width: textWidth, height: nil)
    let spacing = underSpacing(action.sizeThatFits(under))
    place(lead, mark, summary, at: bounds.origin)
    action.place(
      at: CGPoint(x: bounds.minX + markRoom(mark), y: bounds.minY + lead.size.height + spacing),
      proposal: under)
  }

  private func parts(_ subviews: Subviews) -> (LayoutSubview, LayoutSubview, LayoutSubview)? {
    subviews.count == 3 ? (subviews[0], subviews[1], subviews[2]) : nil
  }

  private func lead(_ mark: LayoutSubview, _ summary: LayoutSubview, textWidth: CGFloat?) -> Lead {
    let markDimensions = mark.dimensions(in: .unspecified)
    let summaryProposal = ProposedViewSize(width: textWidth.map { max(0, $0) }, height: nil)
    let summaryDimensions = summary.dimensions(in: summaryProposal)
    // Where the mark's top sits from the summary's, with their `alignment` guides lined up.
    let markTop = summaryDimensions[alignment] - markDimensions[alignment]
    let top = min(0, markTop)
    let bottom = max(summaryDimensions.height, markTop + markDimensions.height)
    let room = markRoom(mark)
    return Lead(
      markOffset: CGPoint(x: 0, y: markTop - top),
      summaryOffset: CGPoint(x: room, y: -top),
      summaryProposal: summaryProposal,
      size: CGSize(width: room + summaryDimensions.width, height: bottom - top))
  }

  private func place(
    _ lead: Lead, _ mark: LayoutSubview, _ summary: LayoutSubview, at origin: CGPoint
  ) {
    mark.place(
      at: CGPoint(x: origin.x + lead.markOffset.x, y: origin.y + lead.markOffset.y),
      proposal: .unspecified)
    summary.place(
      at: CGPoint(x: origin.x + lead.summaryOffset.x, y: origin.y + lead.summaryOffset.y),
      proposal: lead.summaryProposal)
  }

  /// What the mark takes from the line's width: nothing when there's none.
  private func markRoom(_ mark: LayoutSubview) -> CGFloat {
    let width = mark.sizeThatFits(.unspecified).width
    return width > 0 ? width + Self.markSpacing : 0
  }

  /// The actions' own size when they go beside the summary.
  private func besideActionSize(_ textWidth: CGFloat?, _ action: LayoutSubview) -> CGSize? {
    guard !isStacked else { return nil }
    let size = action.sizeThatFits(.unspecified)
    guard let textWidth else { return size }
    return besideWidth(size) <= textWidth / 2 ? size : nil
  }

  private func underSpacing(_ action: CGSize) -> CGFloat {
    action.height > 0 ? Self.underSpacing : 0
  }

  /// What the actions take from the summary's width: nothing when there are none.
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
  /// Inside a suggestion's line, whose words take its size.
  @Entry var isInSuggestionLine = false
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
