import SwiftUI

/// Main's Mind maps page: Study over the Chapters, Lessons and Saved tabs, each a short index of the
/// maps that open, then on Chapters the ones not made yet. Opened from a subject, it starts at that
/// subject's maps in the tab it opens, unfolded.
struct MindMapsScreen: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(MindMapsStore.self) private var store

  var subjectKey: String?

  @State private var tab: GoalMindMaps.Tab?
  @State private var keptSaves = KeptRows<SavedMindMap>()

  var body: some View {
    if let goal = learner.summary.value?.shownGoal {
      let list = store.list(goalId: goal.id)
      let stop = store.shownStop(goalId: goal.id)

      // The offer's stop holds until a read lifts it; its day, by this device's clock, only says
      // when to read the offer again, whichever tab is shown and with no chapter listed.
      OpeningClock(availableAt: stop?.availableAt) { now in
        let isOver = stop?.isOver(at: now) ?? false

        content(list: list, goal: goal)
          .task(id: isOver) {
            if isOver {
              await store.readOfferAgain(goalId: goal.id, now: now)
            }
          }
      }
      .barTitleAfterHero(
        String(localized: "Mind maps", table: "MindMaps", comment: "Title of the mind maps page")
      )
      .loads(list)
      .mindMapSaveVisit()
      .forgetsKeptRows($keptSaves)
      // One follower for every map on its way, each at its own pace.
      .task(id: Following(goalId: goal.id, maps: list.value)) {
        await store.followList(goalId: goal.id)
      }
    }
  }

  private var title: Text {
    Text("Mind maps", tableName: "MindMaps", comment: "Title of the mind maps page")
  }

  @ViewBuilder
  private func content(list: Resource<GoalMindMaps>, goal: LearnerGoal) -> some View {
    switch list.state {
    case .loaded(let maps):
      let shown = tab ?? maps.firstTab
      let notMade = maps.notMade

      // Main's right column: beside the maps on every tab where there's room, so the page keeps
      // its width as tabs switch; without it, the list follows the chapters' maps.
      PaneBeside(isAvailable: !notMade.isEmpty, paneEdge: .trailing, primaryShare: 0.62) {
        ZoonkList {
          MindMapCreateSection(goalId: goal.id, maps: maps, notMade: notMade)
        }
      } content: { isBeside in
        ScrollViewReader { proxy in
          ZoonkList {
            Section {
              PageHeader(title)

              Picker(selection: $tab) {
                ForEach(GoalMindMaps.Tab.allCases, id: \.self) { tab in
                  tabTitle(tab, maps: maps)
                    .tag(Optional(tab))
                }
              } label: {
                Text("Maps", tableName: "MindMaps", comment: "Picks which maps the page lists")
              }
              .pickerStyle(.segmented)
              .listRowSeparator(.hidden)
            }

            switch shown {
            case .chapters:
              MindMapChaptersTab(
                goalId: goal.id, maps: maps, subjectKey: subjectKey, listsNotMade: !isBeside)
            case .lessons:
              MindMapLessonsTab(goalId: goal.id, maps: maps, subjectKey: subjectKey)
            case .saved:
              MindMapSavedTab(goalId: goal.id, maps: maps, kept: $keptSaves)
            }
          }
          .onAppear {
            if tab == nil {
              tab = shown
            }

            if let subjectKey {
              proxy.scrollTo(subjectKey, anchor: .top)
            }
          }
        }
        .lonePage(!isBeside)
        // Study opens what the tab counts, where this device last was in it. The bar is the maps'
        // own, as main's, so it ends where their column ends, not under the list beside them.
        .bottomBar {
          if count(shown, maps: maps) > 0 {
            Button {
              router.open(.mindMapStudy(goalId: goal.id, tab: shown))
            } label: {
              Text("Study maps", tableName: "MindMaps")
            }
            .buttonStyle(.mainAction)
            .keyboardShortcut(.defaultAction)
          }
        }
      }
    case .empty:
      StateMessage {
        Label {
          Text(
            "No mind maps yet", tableName: "MindMaps", comment: "Title when no chapter has a map")
        } icon: {
          Image(systemName: LearnKind.mindMap.systemImage)
        }
      } description: {
        Text(
          "Your plan's chapters show here once they're ready, each with its mind map.",
          tableName: "MindMaps", comment: "Why the mind maps page has no chapters yet")
      }
      .lonePage()
    case .failed:
      MindMapUnreachable {
        Task { await list.refresh() }
      }
    case .idle, .loading:
      ProgressView()
    }
  }

  /// Each tab with what Study opens on it.
  private func tabTitle(_ tab: GoalMindMaps.Tab, maps: GoalMindMaps) -> Text {
    let count = count(tab, maps: maps)

    return switch tab {
    case .chapters:
      Text(
        "Chapter maps \(count)", tableName: "MindMaps",
        comment: "Tab of chapter mind maps, with how many open")
    case .lessons:
      Text(
        "Lesson maps \(count)", tableName: "MindMaps",
        comment: "Tab of lesson maps, with how many open")
    case .saved:
      Text(
        "Saved \(count)", tableName: "MindMaps",
        comment: "Tab of the learner's saved maps, with how many open")
    }
  }

  /// What Study opens on the tab.
  private func count(_ tab: GoalMindMaps.Tab, maps: GoalMindMaps) -> Int {
    switch tab {
    case .chapters:
      maps.chapters.count { $0.status == .ready }
    case .lessons:
      maps.lessonGroups.reduce(0) { $0 + $1.lessonIds.count }
    case .saved:
      maps.saved.count { $0.available && store.saves.isSaved($0.key, server: true) }
    }
  }
}

/// What the follower's pace depends on: it starts again when that changes.
private struct Following: Hashable {
  let goalId: String
  let drawing: Bool
  let writing: Bool

  init(goalId: String, maps: GoalMindMaps?) {
    self.goalId = goalId
    drawing = maps?.chapters.contains { $0.status == .drawing } ?? false
    writing = maps?.chapters.contains { $0.status == .writingLessons } ?? false
  }
}

// MARK: - Chapters

private struct MindMapChaptersTab: View {
  let goalId: String
  let maps: GoalMindMaps
  let subjectKey: String?
  /// False while the list of chapters without a map sits in its own pane beside this one.
  let listsNotMade: Bool

  var body: some View {
    let index = maps.chapters.filter { $0.status == .ready }

    MindMapIndex(items: index, subject: \.subject, opensAt: subjectKey) { map in
      MindMapRow(goalId: goalId, map: map, place: .library)
    }

    let notMade = maps.notMade

    if listsNotMade, !notMade.isEmpty {
      MindMapCreateSection(goalId: goalId, maps: maps, notMade: notMade)
    } else if index.isEmpty {
      EmptyTab {
        Text(
          "No mind maps yet", tableName: "MindMaps", comment: "Title when no chapter has a map")
      } description: {
        // A finished chapter's map is claimed like any other, so it waits while the maps are used up.
        if maps.createOffer.stop == nil {
          Text(
            "Your plan's chapters show here once they're ready, each with its mind map.",
            tableName: "MindMaps", comment: "Why the mind maps page has no chapters yet")
        }
      }
    }
  }
}

/// Main's `NotMadeYet`: the chapters without a map, the next few first and the rest folded by
/// subject, or behind one row when the goal has none, with one line for where they stand.
private struct MindMapCreateSection: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(MindMapsStore.self) private var store
  @State private var unfolded: Set<String> = []
  /// The block stays for the visit once it has shown the stop, so its held slot outlives the line.
  @State private var showedStop = false

  let goalId: String
  let maps: GoalMindMaps
  let notMade: [ChapterMindMap]

  /// The offer's stop takes the rows' Create until a read lifts it.
  var body: some View {
    let stop = store.shownStop(goalId: goalId)

    section(stop: stop, canStart: stop == nil)
  }

  /// A failed map's row keeps its Try again, whose retry is free.
  @ViewBuilder
  private func section(stop: MindMapAllowanceStop?, canStart: Bool) -> some View {
    let offer = maps.createOffer
    let line = line(offer, stop: stop, canStart: canStart)
    let isStopped = if case .stopped = line { true } else { false }
    let order = NotMadeOrder(notMade, studied: Set(maps.lessonGroups.map(\.chapterId)))

    Section {
      if offer.stop == nil, showsLessonsNote {
        Text(
          "Creating maps counts toward your free lessons.", tableName: "MindMaps",
          comment:
            "Over the chapters without a map, for a free learner when a chapter's lessons aren't written yet"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
        .listRowSeparator(.hidden)
      }

      ForEach(order.next) { row($0, canStart: canStart) }

      ForEach(order.restGroups, id: \.key) { group in
        FoldRow(isUnfolded: $unfolded.contains(group.key)) {
          HStack {
            Group {
              if let name = group.name {
                Text(name)
              } else if unfolded.contains(group.key) {
                Text(
                  "Show fewer chapters", tableName: "Plan",
                  comment: "Folds a phase's chapters back to the ones around the next")
              } else {
                Text(
                  "\(group.chapters.count) more chapters", tableName: "Plan",
                  comment: "Shows the phase's chapters left out around the next one")
              }
            }
            .typeStyle(group.name == nil ? .body : .rowTitle)
            .foregroundStyle(group.name == nil ? .mutedForeground : Color(.foreground))

            if group.name != nil {
              Spacer(minLength: 8)
              Text(verbatim: group.chapters.count.formatted(.number.locale(.appLanguage)))
                .typeStyle(.data)
                .foregroundStyle(.mutedForeground)
            }
          }
        }

        if unfolded.contains(group.key) {
          ForEach(group.chapters) { row($0, canStart: canStart) }
        }
      }
    } header: {
      SectionTitle(
        Text(
          "No map yet", tableName: "MindMaps",
          comment: "Heading over the chapters whose mind map hasn't been made yet.")
      ) {
        Text(verbatim: notMade.count.formatted(.number.locale(.appLanguage)))
      }
    }

    // A stop the page holds takes "Create all" too: each map it would start is refused.
    let offersAll = offer.startable > 1 && canStart

    if offersAll || line != nil || showedStop {
      Section {
        HeldSlot(gated: isStopped) {
          VStack(alignment: .leading, spacing: 12) {
            if offersAll {
              BusyButton(isBusy: store.creatingAll.contains(goalId), icon: .create) {
                Task { await store.createAll(goalId: goalId) }
              } label: {
                Text(
                  "Create all", tableName: "MindMaps",
                  comment: "Makes every chapter map one tap can start now")
              }
              .buttonStyle(.outline)
              .controlSize(.large)
            }

            if let line {
              lineView(line)
            }
          }
        }
        .onChange(of: isStopped, initial: true) { _, stopped in
          if stopped {
            showedStop = true
          }
        }
        .listRowSeparator(.hidden)
        .announcesStatus(note(line))
      }
    }
  }

  private func line(_ offer: MindMapCreateOffer, stop: MindMapAllowanceStop?, canStart: Bool)
    -> MindMapsCreateLine?
  {
    MindMapsCreateLine(
      maps: maps, stop: stop, canStart: canStart,
      unreachable: store.createAllFailures[goalId] == .unreachable,
      tier: learner.summary.value?.tier ?? .free)
  }

  @ViewBuilder
  private func lineView(_ line: MindMapsCreateLine) -> some View {
    switch line {
    case .unreachable:
      FailureLine(
        message: LocalizedStringResource(
          "We couldn't reach the server. Check your connection.", table: "MindMaps",
          comment: "Asking for a map didn't reach the server"))
    case .stopped(let limit):
      LimitNotice(limit: limit.limit, words: limit.words(now:))
    case .onTheWay, .fewer:
      Text(verbatim: note(line) ?? "")
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
    }
  }

  /// The line's words, when it's a note of the block's own rather than a notice.
  private func note(_ line: MindMapsCreateLine?) -> String? {
    switch line {
    case .onTheWay(let count):
      String(
        localized: "\(count) on the way. You can leave while they're made.", table: "MindMaps",
        locale: .appLanguage, comment: "How many chapter maps are being made now")
    case .fewer(let count):
      String(
        localized: "You can create \(count) more maps right now.", table: "MindMaps",
        locale: .appLanguage,
        comment:
          "Fewer chapter maps can start than are ready to make: as many as the allowance lets")
    case .unreachable, .stopped, nil:
      nil
    }
  }

  private func row(_ map: ChapterMindMap, canStart: Bool) -> some View {
    MindMapRow(goalId: goalId, map: map, place: .notMade(canStart: canStart))
  }

  /// Rows don't repeat that writing lessons spends free lessons: this says it once, when a row
  /// would write them.
  private var showsLessonsNote: Bool {
    learner.summary.value?.tier != .plus
      && notMade.contains { $0.status != .writingLessons && $0.lessonsToWrite > 0 }
  }
}

// MARK: - Lessons

private struct MindMapLessonsTab: View {
  let goalId: String
  let maps: GoalMindMaps
  let subjectKey: String?

  var body: some View {
    if maps.lessonGroups.isEmpty {
      EmptyTab {
        Text(
          "No lesson maps yet", tableName: "MindMaps",
          comment: "The Lessons tab before any lesson map")
      } description: {
        Text(
          "Every lesson ends with one.",
          tableName: "MindMaps", comment: "The Lessons tab before any lesson map")
      }
    } else {
      let groups = maps.lessonGroups.compactMap { group in
        maps.chapter(group.chapterId).map { LessonGroupItem(group: group, chapter: $0) }
      }

      MindMapIndex(items: groups, subject: \.chapter.subject, opensAt: subjectKey) { item in
        LessonGroupRow(goalId: goalId, item: item)
      }
    }
  }
}

private struct LessonGroupItem: Identifiable {
  let group: LessonMapGroup
  let chapter: ChapterMindMap

  var id: String { group.chapterId }
}

/// One row per chapter, opening the Lessons deck at its first map.
private struct LessonGroupRow: View {
  @Environment(AppRouter.self) private var router

  let goalId: String
  let item: LessonGroupItem

  var body: some View {
    Button {
      router.open(
        .mindMapStudy(
          goalId: goalId, tab: .lessons, start: MindMapPosition(chapterId: item.group.chapterId)))
    } label: {
      // Main's row has no square: a lesson map has no picture to show in one.
      VStack(alignment: .leading, spacing: 2) {
        Text(item.chapter.title)
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))

        FactSegments(facts)
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .accessibilityElement(children: .combine)
      .disclosureChevron()
    }
  }

  /// "Chapter 5 · 6 lesson maps".
  private var facts: [String] {
    [
      String(
        localized: "Chapter \(item.chapter.position)", table: "MindMaps",
        locale: .appLanguage, comment: "A chapter's number"),
      String(
        localized: "\(item.group.count) lesson maps", table: "MindMaps",
        locale: .appLanguage, comment: "How many of a chapter's lessons have a map"),
    ]
  }
}

// MARK: - Saved

private struct MindMapSavedTab: View {
  @Environment(MindMapsStore.self) private var store
  @Environment(SaveVisit<SaveTarget>.self) private var visit

  let goalId: String
  let maps: GoalMindMaps
  @Binding var kept: KeptRows<SavedMindMap>

  var body: some View {
    let (open, gone) = kept.sections(maps.saved, available: \.available) {
      store.saves.isSaved($0.key, server: true)
    }

    if open.isEmpty, gone.isEmpty {
      EmptyTab {
        Text(
          "Nothing saved yet", tableName: "MindMaps",
          comment: "The Saved tab before the learner saves a map")
      } description: {
        Text(
          "Tap the bookmark on a map to keep it here.", tableName: "MindMaps",
          comment: "The Saved tab before the learner saves a map")
      }
    }

    Section {
      ForEach(open) { save in
        SavedRow(
          goalId: goalId, save: save, chapter: save.chapterId.flatMap(maps.chapter),
          isListed: maps.saved.contains { $0.key == save.key }
        ) {
          kept.keep(save, shown: open)
        }
      }
    }

    if !gone.isEmpty {
      Section {
        ForEach(gone) { save in
          UnavailableSaveRow(
            title: save.title,
            remove: Text("Remove", tableName: "MindMaps", comment: "Removes a saved map"),
            spoken: Text(
              "Remove \(save.title) from saved maps", tableName: "MindMaps",
              comment: "What screen readers say for Remove, naming the map.")
          ) {
            visit.set(
              false, SaveTarget(key: save.key, title: save.title, chapterId: nil), goalId: goalId,
              in: store.saves)
          } detail: {
            SavedKind(kind: save.kind)
          }
        }
      } header: {
        SectionTitle(
          Text(
            "No longer available", tableName: "MindMaps",
            comment: "Saved maps that can't open in this goal anymore"))
      }
    }
  }
}

extension SavedMindMap: Identifiable {
  var id: MindMapKey { key }
}

/// Opens the Saved deck at this map; its bookmark, a swipe or its menu takes it out, and the row
/// stays with its bookmark empty until the learner leaves the page, opening its kind's deck.
private struct SavedRow: View {
  @Environment(AppRouter.self) private var router
  @Environment(MindMapsStore.self) private var store
  @Environment(SaveVisit<SaveTarget>.self) private var visit

  let goalId: String
  let save: SavedMindMap
  let chapter: ChapterMindMap?
  /// The last read lists it: a row kept after its removal isn't.
  let isListed: Bool
  let keep: () -> Void

  var body: some View {
    let isSaved = store.saves.isSaved(save.key, server: isListed)

    HStack(spacing: RowSaveToggle.gap) {
      Button {
        router.open(
          .mindMapStudy(
            goalId: goalId, tab: MindMapDeck.tab(opening: save, isSaved: isSaved),
            start: save.chapterId.map { MindMapPosition(chapterId: $0, key: save.key) }))
      } label: {
        MarkedRow(alignment: .center) {
          MindMapSlot(MindMapSlotLook(kind: save.kind, picture: thumbnail)) {
            Image(systemName: save.kind == .lesson ? LessonMapView.symbol : "map")
              .foregroundStyle(.mutedForeground)
          }
        } content: {
          VStack(alignment: .leading, spacing: 2) {
            Text(save.title)
              .typeStyle(.rowTitle)
              .foregroundStyle(Color(.foreground))

            SavedKind(kind: save.kind)
          }
          .accessibilityElement(children: .combine)
        } end: {
          EmptyView()
        }
      }

      RowSaveToggle(
        isSaved: isSaved,
        save: Text("Save \(save.title)", tableName: "MindMaps"),
        saved: Text(
          "Saved \(save.title)", tableName: "MindMaps",
          comment:
            "Read aloud for the bookmark on a saved mind map's row, which removes it: says the map {title} is saved."
        )
      ) {
        toggle(isSaved)
      }
    }
    .savesFromRow(
      isSaved: isSaved, save: MindMapSaveWords.save,
      remove: Text(
        "Remove from saved", tableName: "MindMaps",
        comment: "Takes a map out of the learner's saved maps")
    ) {
      toggle(isSaved)
    }
  }

  private func toggle(_ isSaved: Bool) {
    keep()
    visit.set(
      !isSaved, SaveTarget(key: save.key, title: save.title, chapterId: save.chapterId),
      goalId: goalId, in: store.saves)
  }

  private var thumbnail: URL? {
    chapter?.image.flatMap { URL(string: $0.thumbnailUrl ?? $0.url) }
  }
}

/// A saved map's kind, as main's Saved tab names it in place of a chapter's number.
private struct SavedKind: View {
  let kind: SavedMindMapKind

  var body: some View {
    Group {
      switch kind {
      case .chapter:
        Text(
          "Chapter map", tableName: "MindMaps",
          comment: "A kind of mind map: one for a whole chapter")
      case .lesson:
        Text(LessonMapView.name)
      }
    }
    .typeStyle(.meta)
    .foregroundStyle(.mutedForeground)
  }
}

/// A tab without maps yet: what will show there, and how.
private struct EmptyTab<Title: View, Description: View>: View {
  @ViewBuilder let title: Title
  @ViewBuilder let description: Description

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 4) {
        title
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))

        description
          .typeStyle(.body)
          .foregroundStyle(.mutedForeground)
      }
      .listRowSeparator(.hidden)
    }
  }
}

// MARK: - Index

/// Main's bounded index: sections stay open while there are 12 maps or fewer, past that each
/// subject folds to its header; without subjects, the first 8 and "Show all".
private struct MindMapIndex<Item: Identifiable, Row: View>: View {
  let items: [Item]
  let subject: (Item) -> ChapterMindMap.Subject?
  @ViewBuilder let row: (Item) -> Row

  @State private var unfolded: Set<String>
  @State private var showsAll = false

  /// `opensAt` starts with that subject unfolded.
  init(
    items: [Item], subject: @escaping (Item) -> ChapterMindMap.Subject?, opensAt: String? = nil,
    @ViewBuilder row: @escaping (Item) -> Row
  ) {
    self.items = items
    self.subject = subject
    self.row = row
    _unfolded = State(initialValue: opensAt.map { [$0] } ?? [])
  }

  private static var openLimit: Int { 12 }
  private static var shortList: Int { 8 }

  var body: some View {
    let groups = groups
    let hasSubjects = groups.contains { $0.subject != nil }

    if items.count <= Self.openLimit {
      ForEach(groups, id: \.key) { group in
        Section {
          ForEach(group.items) { row($0) }
        } header: {
          if let subject = group.subject {
            SectionTitle(Text(subject.name)) {
              Text(verbatim: group.items.count.formatted(.number.locale(.appLanguage)))
            }
          }
        }
        .id(group.key)
      }
    } else if hasSubjects {
      ForEach(groups, id: \.key) { group in
        Section {
          FoldRow(isUnfolded: $unfolded.contains(group.key)) {
            SectionTitle(Text(group.subject?.name ?? "")) {
              Text(verbatim: group.items.count.formatted(.number.locale(.appLanguage)))
            }
          }

          if unfolded.contains(group.key) {
            ForEach(group.items) { row($0) }
          }
        }
        .id(group.key)
      }
    } else {
      Section {
        ForEach(showsAll ? items : Array(items.prefix(Self.shortList))) { row($0) }

        if !showsAll {
          Button {
            showsAll = true
          } label: {
            Text(
              "Show all \(items.count)", tableName: "MindMaps",
              comment: "Shows every map of the tab")
          }
        }
      }
    }
  }

  /// In order of each subject's first map; maps without one are one group.
  private var groups: [IndexGroup] {
    var groups: [IndexGroup] = []

    for item in items {
      let subject = subject(item)
      let key = subject?.key ?? ""

      if let index = groups.firstIndex(where: { $0.key == key }) {
        groups[index].items.append(item)
      } else {
        groups.append(IndexGroup(key: key, subject: subject, items: [item]))
      }
    }

    return groups
  }

  private struct IndexGroup {
    let key: String
    let subject: ChapterMindMap.Subject?
    var items: [Item]
  }
}

/// The one line under "Create all": the first of these that applies. What stops the learner
/// outranks what's in progress. Each map on its way, and each that didn't finish with its Try again,
/// says so in its own row, and their group opens on arrival.
enum MindMapsCreateLine: Equatable {
  case unreachable
  case onTheWay(Int)
  case stopped(MindMapLimit)
  case fewer(Int)

  init?(
    maps: GoalMindMaps, stop: MindMapAllowanceStop?, canStart: Bool, unreachable: Bool,
    tier: LearnerTier
  ) {
    let offer = maps.createOffer
    // As main's, only the chapters under "No map yet": the others' rows say where they stand.
    let onTheWay = maps.chapters.count { $0.status.isOnItsWay }

    if unreachable {
      self = .unreachable
    } else if offer.startable == 0, !canStart, let stop {
      self = .stopped(stop.limit(tier: tier))
    } else if onTheWay > 0 {
      self = .onTheWay(onTheWay)
    } else if offer.startable > 0, offer.startable < offer.eligible {
      self = .fewer(offer.startable)
    } else {
      return nil
    }
  }
}
