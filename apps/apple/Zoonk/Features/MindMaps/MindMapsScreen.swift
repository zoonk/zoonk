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

  var body: some View {
    if let goal = learner.summary.value?.shownGoal {
      let list = store.list(goalId: goal.id)

      content(list: list, goal: goal)
        .barTitleAfterHero(
          String(localized: "Mind maps", table: "MindMaps", comment: "Title of the mind maps page")
        )
        .loads(list)
        .mindMapSaveFailureAlert(goalId: goal.id)
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

      ScrollViewReader { proxy in
        ZoonkList {
          Section {
            PageHeader(title, supporting: Text(verbatim: goal.displayName))

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
            MindMapChaptersTab(goalId: goal.id, maps: maps, subjectKey: subjectKey)
          case .lessons:
            MindMapLessonsTab(goalId: goal.id, maps: maps, subjectKey: subjectKey)
          case .saved:
            MindMapSavedTab(goalId: goal.id, maps: maps)
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
      .lonePage()
      // Study opens what the tab counts, where this device last was in it.
      .bottomBar {
        if count(shown, maps: maps) > 0 {
          Button {
            router.open(.mindMapStudy(goalId: goal.id, tab: shown))
          } label: {
            Text("Study", tableName: "MindMaps", comment: "Opens a tab's maps one per screen")
          }
          .buttonStyle(.mainAction)
          .keyboardShortcut(.defaultAction)
        }
      }
    case .empty:
      ContentUnavailableView {
        Label {
          Text(
            "No mind maps yet", tableName: "MindMaps", comment: "Title when no chapter has a map")
        } icon: {
          KindMark(kind: .mindMap)
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
        "Chapters \(count)", tableName: "MindMaps",
        comment: "Tab of chapter mind maps, with how many open")
    case .lessons:
      Text(
        "Lessons \(count)", tableName: "MindMaps", comment: "Tab of lesson maps, with how many open"
      )
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
      maps.lessonGroups.reduce(0) { $0 + $1.opens }
    case .saved:
      maps.saved.count { $0.available && store.isSaved($0.key, server: true) }
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

  var body: some View {
    let index = maps.chapters.filter { $0.status == .ready || $0.status == .plusRequired }

    MindMapIndex(items: index, subject: \.subject, opensAt: subjectKey) { map in
      MindMapRow(goalId: goalId, map: map, place: .library)
    }

    let notMade = maps.chapters.filter {
      [.available, .failed, .writingLessons, .drawing].contains($0.status)
    }

    if !notMade.isEmpty {
      MindMapCreateSection(goalId: goalId, maps: maps, notMade: notMade)
    } else if index.isEmpty {
      EmptyTab {
        Text(
          "No mind maps yet", tableName: "MindMaps", comment: "Title when no chapter has a map")
      } description: {
        Text(
          "Your plan's chapters show here once they're ready, each with its mind map.",
          tableName: "MindMaps", comment: "Why the mind maps page has no chapters yet")
      }
    }
  }
}

/// The chapters without a map yet. Those that can be made now come first, each with its own button;
/// the rest wait folded under one row, with one line for where they stand.
private struct MindMapCreateSection: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(MindMapsStore.self) private var store
  @State private var showsChapters = false

  let goalId: String
  let maps: GoalMindMaps
  let notMade: [ChapterMindMap]

  var body: some View {
    let offer = maps.createOffer
    let line = line(offer)
    // A failed map's row keeps its Try again, whose retry is free.
    let canStart = offer.stop == nil

    let ready = notMade.filter { $0.lessonsToWrite == 0 && $0.status != .writingLessons }
    let others = notMade.filter { !ready.contains($0) }

    Section {
      ForEach(ready) { map in
        MindMapRow(goalId: goalId, map: map, place: .notMade(canStart: canStart))
      }

      if offer.startable > 1 || line != nil {
        VStack(alignment: .leading, spacing: 12) {
          if offer.startable > 1 {
            BusyButton(isBusy: store.creatingAll.contains(goalId), icon: .create) {
              Task { await store.createAll(goalId: goalId) }
            } label: {
              Text(
                "Create all", tableName: "MindMaps",
                comment: "Makes every chapter map one tap can start now")
            }
            .buttonStyle(.outline)
            .controlSize(.large)
            .listRowButtonIcon()
          }

          if let line {
            lineView(line)
          }
        }
        .listRowSeparator(.hidden)
        .announcesStatus(note(line))
      }

      if !others.isEmpty {
        FoldRow(isUnfolded: $showsChapters) {
          LabeledContent {
            Text(verbatim: others.count.formatted())
              .typeStyle(.data)
              .foregroundStyle(.mutedForeground)
          } label: {
            Text(
              "Other chapters", tableName: "MindMaps",
              comment: "Unfolds the chapters whose maps can't be made right now"
            )
            .typeStyle(.body)
          }
        }

        if showsChapters {
          ForEach(others) { map in
            MindMapRow(goalId: goalId, map: map, place: .notMade(canStart: canStart))
          }
        }
      }
    }
  }

  /// The one line under the button: the first of these that applies. Maps on their way and maps
  /// that didn't finish come before the limit: the learner just started them, and the limit read
  /// first looks like a refusal.
  private enum Line {
    case unreachable
    case onTheWay(Int)
    case unfinished(Int)
    case stopped(MindMapLimit)
    case fewer(Int)
  }

  private func line(_ offer: MindMapCreateOffer) -> Line? {
    let onTheWay = maps.chapters.count { $0.status.isOnItsWay }
    // Only the ones the button retries: a failed map whose lessons aren't written says so in its
    // own row.
    let unfinished = maps.chapters.count { $0.status == .failed && $0.lessonsToWrite == 0 }

    if store.createAllFailures[goalId] == .unreachable {
      return .unreachable
    }

    if onTheWay > 0 {
      return .onTheWay(onTheWay)
    }

    if unfinished > 0 {
      return .unfinished(unfinished)
    }

    if offer.startable == 0, let stop = offer.stop {
      return .stopped(stop.limit(tier: learner.summary.value?.tier ?? .free))
    }

    if offer.startable > 0, offer.startable < offer.eligible {
      return .fewer(offer.startable)
    }

    return nil
  }

  @ViewBuilder
  private func lineView(_ line: Line) -> some View {
    switch line {
    case .unreachable:
      FailureLine(
        message: LocalizedStringResource(
          "We couldn't reach the server. Check your connection.", table: "MindMaps",
          comment: "Asking for a map didn't reach the server"))
    case .stopped(let limit):
      LimitNotice(limit: limit.limit, words: limit.words)
    case .onTheWay, .unfinished, .fewer:
      Text(verbatim: note(line) ?? "")
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
    }
  }

  /// The line's words, when it's a note of the block's own rather than a notice.
  private func note(_ line: Line?) -> String? {
    switch line {
    case .onTheWay(let count):
      String(
        localized: "\(count) on the way. You can leave while they're made.", table: "MindMaps",
        comment: "How many chapter maps are being made now")
    case .unfinished(let count):
      String(
        localized: "\(count) maps didn't finish. Try again.", table: "MindMaps",
        comment:
          "Chapter maps whose making failed; the button above makes them again, for free")
    case .fewer(let count):
      String(
        localized: "You can make \(count) more right now.", table: "MindMaps",
        comment:
          "Fewer chapter maps can start than are ready to make: as many as the allowance lets")
    case .unreachable, .stopped, nil:
      nil
    }
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

/// One row per chapter, opening the Lessons deck at its first map; all locked, it leads to Plus.
private struct LessonGroupRow: View {
  @Environment(AppRouter.self) private var router

  let goalId: String
  let item: LessonGroupItem

  var body: some View {
    Button {
      if item.group.opens > 0 {
        router.open(
          .mindMapStudy(
            goalId: goalId, tab: .lessons,
            start: MindMapPosition(chapterId: item.group.chapterId)))
      } else {
        router.present(.subscription)
      }
    } label: {
      MarkedRow(alignment: .center) {
        MindMapSlot {
          Image(systemName: item.group.opens > 0 ? LessonMapView.symbol : "lock")
            .foregroundStyle(.mutedForeground)
        }
      } content: {
        VStack(alignment: .leading, spacing: 2) {
          Text(item.chapter.title)
            .typeStyle(.rowTitle)
            .foregroundStyle(Color(.foreground))

          Text(verbatim: facts)
            .typeStyle(.meta)
            .foregroundStyle(.mutedForeground)
        }
        .accessibilityElement(children: .combine)
      } end: {
        EmptyView()
      }
      .disclosureChevron()
    }
  }

  /// "Chapter 5 · 6 lesson maps".
  private var facts: String {
    [
      String(
        localized: "Chapter \(item.chapter.position)", table: "MindMaps",
        comment: "A chapter's number"),
      String(
        localized: "\(item.group.count) lesson maps", table: "MindMaps",
        comment: "How many of a chapter's lessons have a map"),
    ].joinedFacts()
  }
}

// MARK: - Saved

private struct MindMapSavedTab: View {
  @Environment(MindMapsStore.self) private var store

  let goalId: String
  let maps: GoalMindMaps

  var body: some View {
    let shown = maps.saved.filter { store.isSaved($0.key, server: true) }
    let open = shown.filter(\.available)
    let gone = shown.filter { !$0.available }

    if shown.isEmpty {
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

    let items = open.map { SavedItem(save: $0, chapter: $0.chapterId.flatMap(maps.chapter)) }

    Section {
      ForEach(items) { SavedRow(goalId: goalId, item: $0) }
    }

    if !gone.isEmpty {
      Section {
        ForEach(gone, id: \.key) { save in
          LabeledContent {
            Button {
              store.setSaved(
                false, target: SaveTarget(key: save.key, title: save.title, chapterId: nil),
                goalId: goalId)
            } label: {
              Text("Remove", tableName: "MindMaps", comment: "Removes a saved map")
            }
            .buttonStyle(.outline)
            .controlSize(.small)
          } label: {
            VStack(alignment: .leading, spacing: 2) {
              Text(save.title)
                .typeStyle(.rowTitle)
                .foregroundStyle(.mutedForeground)

              SavedKind(kind: save.kind)
            }
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

private struct SavedItem: Identifiable {
  let save: SavedMindMap
  let chapter: ChapterMindMap?

  var id: MindMapKey { save.key }
}

/// Opens the Saved deck at this map; a swipe or its menu takes it out.
private struct SavedRow: View {
  @Environment(AppRouter.self) private var router

  let goalId: String
  let item: SavedItem

  var body: some View {
    let save = item.save
    let target = SaveTarget(key: save.key, title: save.title, chapterId: save.chapterId)

    Button {
      router.open(
        .mindMapStudy(
          goalId: goalId, tab: .saved,
          start: save.chapterId.map { MindMapPosition(chapterId: $0, key: save.key) }))
    } label: {
      MarkedRow(alignment: .center) {
        if save.kind == .chapter, let thumbnail {
          MindMapSlot(picture: thumbnail)
        } else {
          MindMapSlot {
            Image(systemName: save.kind == .lesson ? LessonMapView.symbol : "map")
              .foregroundStyle(.mutedForeground)
          }
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
      .disclosureChevron()
    }
    .savesMindMap(target, goalId: goalId, server: true)
  }

  private var thumbnail: URL? {
    item.chapter?.image.flatMap { URL(string: $0.thumbnailUrl ?? $0.url) }
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

/// A row that shows the rows after it: they follow it as rows of their own, on the page's left
/// edge, where a `DisclosureGroup`'s content would sit indented under it.
private struct FoldRow<Label: View>: View {
  @Binding var isUnfolded: Bool
  @ViewBuilder let label: Label

  var body: some View {
    DisclosureGroup(isExpanded: $isUnfolded) {
    } label: {
      label
    }
  }
}

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
              Text(verbatim: group.items.count.formatted())
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
              Text(verbatim: group.items.count.formatted())
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
