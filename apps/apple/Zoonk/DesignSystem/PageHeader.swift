import SwiftUI

/// Main's page header, as a page's first row: the page's title, at most one supporting line, and at
/// its end the page's main readout or its action. A page has nothing over its title (B1-038); a
/// task's step, card or result may take the one `Chip` there. The page keeps `navigationTitle`
/// through `barTitleAfterHero(_:)`, so Back, VoiceOver and the iPad and iPhone Duo bars name it,
/// and its bar shows the name only once this title scrolls under it. A page about someone, as the
/// buddy's is, leads its title with their `mark` and puts their status `beside` it; at
/// accessibility sizes the three stack.
struct PageHeader<Mark: View, Beside: View, Trailing: View>: View {
  let title: Text
  var chip: Chip?
  /// Where the learner is, at the chip's row's end: a test's time.
  var position: Text?
  /// A step keeps its chip's room without one, so every step's title sits at one height.
  var keepsChipRoom = false
  var supporting: Text?
  var facts: [String] = []
  /// Main's `DetailFacts`: a chapter's, subject's or unit's facts ("Chapter 3 · 3 lessons · 14 min")
  /// are data, in its role, where any other page's line is words.
  var supportingIsFacts = false
  @ViewBuilder let mark: Mark
  @ViewBuilder let beside: Beside
  @ViewBuilder let trailing: Trailing

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibility

  private var titleCapHeight: Double {
    TypeStyle.pageTitle.uiFont(dynamicTypeSize, legibility: legibility).capHeight
  }

  init(
    _ title: Text, chip: Chip? = nil, position: Text? = nil, keepsChipRoom: Bool = false,
    supporting: Text? = nil, supportingIsFacts: Bool = false, facts: [String] = [],
    @ViewBuilder mark: () -> Mark, @ViewBuilder beside: () -> Beside,
    @ViewBuilder trailing: () -> Trailing
  ) {
    self.title = title
    self.chip = chip
    self.position = position
    self.keepsChipRoom = keepsChipRoom
    self.supporting = supporting
    self.facts = facts
    self.supportingIsFacts = supportingIsFacts
    self.mark = mark()
    self.beside = beside()
    self.trailing = trailing()
  }

  var body: some View {
    let titleCapHeight = titleCapHeight
    return VStack(alignment: .leading, spacing: 4) {
      if let chip {
        ChipRow(chip: chip, position: position)
          .padding(.bottom, 8)
      } else if keepsChipRoom {
        Chip(Text(verbatim: " "))
          .hidden()
          .accessibilityHidden(true)
          .padding(.bottom, 8)
      }

      AccessibilityStack(alignment: .firstTextBaseline, spacing: 12) {
        AccessibilityStack(alignment: .firstTextBaseline, spacing: 12, stackedSpacing: 4) {
          mark
            .centeredOnCaps(titleCapHeight)

          AccessibilityStack(alignment: .firstTextBaseline, spacing: 10, stackedSpacing: 0) {
            title
              .typeStyle(.pageTitle)
              .foregroundStyle(Color(.foreground))
              .accessibilityAddTraits(.isHeader)
              .heroTitle()

            beside
              .centeredOnCaps(titleCapHeight)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        trailing
          .centeredOnCaps(titleCapHeight)
      }

      if !facts.isEmpty {
        FactSegments(facts)
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
      } else if let supporting {
        supporting
          .typeStyle(supportingIsFacts ? .data : .body)
          .foregroundStyle(.mutedForeground)
      }
    }
    .padding(.bottom, 8)
    .listRowSeparator(.hidden)
  }
}

extension PageHeader where Mark == EmptyView, Beside == EmptyView {
  init(
    _ title: Text, chip: Chip? = nil, position: Text? = nil, keepsChipRoom: Bool = false,
    supporting: Text? = nil, supportingIsFacts: Bool = false, facts: [String] = [],
    @ViewBuilder trailing: () -> Trailing
  ) {
    self.init(
      title, chip: chip, position: position, keepsChipRoom: keepsChipRoom,
      supporting: supporting, supportingIsFacts: supportingIsFacts, facts: facts,
      mark: { EmptyView() }, beside: { EmptyView() }, trailing: trailing)
  }
}

extension PageHeader where Mark == EmptyView, Beside == EmptyView, Trailing == EmptyView {
  init(
    _ title: Text, chip: Chip? = nil, position: Text? = nil, keepsChipRoom: Bool = false,
    supporting: Text? = nil, supportingIsFacts: Bool = false, facts: [String] = []
  ) {
    self.init(
      title, chip: chip, position: position, keepsChipRoom: keepsChipRoom,
      supporting: supporting, supportingIsFacts: supportingIsFacts, facts: facts
    ) {
      EmptyView()
    }
  }
}

extension View {
  /// Centered on the middle of the title's capitals, not on its baseline (craft E6).
  fileprivate func centeredOnCaps(_ capHeight: Double) -> some View {
    alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + capHeight / 2 }
  }
}
