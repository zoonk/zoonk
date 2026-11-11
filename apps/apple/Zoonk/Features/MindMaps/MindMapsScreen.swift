import SwiftUI

/// Main's Mind maps page: Study over the Chapters, Lessons and Saved tabs, each a short index of the
/// maps that open, then on Chapters the ones not made yet. Opened from a subject, it starts at that
/// subject's chapter maps.
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
        .navigationTitle(title)
        .barTitleAfterHero(
          String(localized: "Mind maps", table: "MindMaps", comment: "Title of the mind maps page")
        )
        .loads(list)
        .mindMapSaveFailureAlert(goalId: goal.id)
        // One follower for every map on its way, each at its own pace.
        .task(id: Following(list.value)) {
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
      let shown = tab ?? (subjectKey == nil ? maps.firstTab : .chapters)

      ScrollViewReader { proxy in
        ZoonkList {
          Section {
            header(maps, goal: goal, tab: shown)

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
            MindMapLessonsTab(goalId: goal.id, maps: maps)
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
      ContentUnavailableView {
        Label {
          Text(
            "We couldn't reach the server.", tableName: "MindMaps",
            comment: "Shown when mind maps failed to load")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } actions: {
        Button {
          Task { await list.refresh() }
        } label: {
          Text("Try again", tableName: "MindMaps", comment: "Retries")
        }
        .buttonStyle(.outline)
      }
      .lonePage()
    case .idle, .loading:
      ProgressView()
    }
  }

  /// Study opens what the tab counts, where this device last was in it.
  private func header(_ maps: GoalMindMaps, goal: LearnerGoal, tab: GoalMindMaps.Tab) -> some View {
    PageHeader(title, eyebrow: Text(goal.displayName)) {
      if count(tab, maps: maps) > 0 {
        Button {
          router.open(.mindMapStudy(tab: tab))
        } label: {
          Text("Study", tableName: "MindMaps", comment: "Opens a tab's maps one per screen")
        }
        .buttonStyle(.mainAction)
        .keyboardShortcut(.defaultAction)
      }
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
  let drawing: Bool
  let writing: Bool

  init(_ maps: GoalMindMaps?) {
    drawing = maps?.chapters.contains { $0.status == .drawing } ?? false
    writing = maps?.chapters.contains { $0.status == .writingLessons } ?? false
  }
}

// MARK: - Chapters

private struct MindMapChaptersTab: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(MindMapsStore.self) private var store

  let goalId: String
  let maps: GoalMindMaps
  let subjectKey: String?

  var body: some View {
    let index = maps.chapters.filter { $0.status == .ready || $0.status == .plusRequired }

    // Locked rows don't each offer Plus: this says it once.
    if maps.chapters.contains(where: { $0.status == .plusRequired }) {
      Section {
        FreeWeekOverNotice()
      }
    }

    MindMapIndex(items: index, subject: \.subject, opensAt: subjectKey) { map in
      MindMapRow(goalId: goalId, map: map, place: .library)
    }

    let notMade = maps.chapters.filter {
      [.available, .failed, .writingLessons, .drawing].contains($0.status)
    }

    if !notMade.isEmpty {
      MindMapCreateSection(goalId: goalId, maps: maps, notMade: notMade, isAlone: index.isEmpty)
    }
  }
}

/// The chapters without a map yet: a line for where the goal stands, one button for every map one
/// tap can make, and the chapters themselves folded, each with its own Create.
private struct MindMapCreateSection: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(MindMapsStore.self) private var store
  @State private var showsChapters = false

  let goalId: String
  let maps: GoalMindMaps
  let notMade: [ChapterMindMap]
  /// No chapter map opens yet, so this is the tab.
  let isAlone: Bool

  var body: some View {
    let offer = maps.createOffer

    Section {
      VStack(alignment: .leading, spacing: 12) {
        Text(verbatim: progress)
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
          .contentTransition(.numericText())

        if offer.startable > 0 {
          Text(verbatim: offerLine(offer))
            .typeStyle(.body)
            .foregroundStyle(.mutedForeground)

          BusyButton(isBusy: store.creatingAll.contains(goalId)) {
            Task { await store.createAll(goalId: goalId) }
          } label: {
            if offer.startable == offer.eligible {
              Text(
                "Create all chapter maps", tableName: "MindMaps",
                comment: "Makes every chapter map one tap can make")
            } else {
              Text(
                "Create up to \(offer.startable) chapter maps", tableName: "MindMaps",
                comment: "Makes as many chapter maps as the learner's allowance lets start now")
            }
          }
          .buttonStyle(.outline)
        } else if offer.eligible > 0, let stop = offer.stop {
          let limit = stop.limit(tier: learner.summary.value?.tier ?? .free)

          HelpLimitNotice(limit: limit.limit, message: limit.message)
        }

        if store.createAllFailures[goalId] == .unreachable {
          FailureLine(
            message: LocalizedStringResource(
              "We couldn't reach the server. Check your connection.", table: "MindMaps",
              comment: "Asking for a map didn't reach the server"))
        }

        if offer.needLessons > 0 {
          Text(
            "\(offer.needLessons) chapters need their lessons written first. Create each map on its own below.",
            tableName: "MindMaps",
            comment:
              "Chapters whose maps can't be made all at once, since each writes its lessons first from its own row"
          )
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        }
      }
      .listRowSeparator(.hidden)
      .announcesStatus(progress)

      DisclosureGroup(isExpanded: $showsChapters) {
        if let lessonsNote {
          Text(verbatim: lessonsNote)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }

        ForEach(notMade) { map in
          MindMapRow(goalId: goalId, map: map, place: .library)
        }
      } label: {
        Text("Show chapters", tableName: "MindMaps", comment: "Unfolds the chapters without a map")
          .typeStyle(.body)
      }
    } header: {
      SectionTitle(
        Text("Not made yet", tableName: "MindMaps", comment: "Chapters whose maps aren't made yet"))
    }
  }

  /// Rows don't repeat what making a map of a chapter whose lessons aren't written means: this says
  /// it once, when a row can.
  private var lessonsNote: String? {
    guard notMade.contains(where: { $0.status != .writingLessons && $0.lessonsToWrite > 0 }) else {
      return nil
    }

    return learner.summary.value?.tier == .plus
      ? String(
        localized:
          "Making a map for one of these writes its lessons first, so it takes a few minutes.",
        table: "MindMaps",
        comment:
          "Over the chapters without a map, for a Plus learner with chapters whose lessons aren't written yet"
      )
      : String(
        localized:
          "Making a map for one of these writes its lessons first, which counts toward your free lessons.",
        table: "MindMaps",
        comment:
          "Over the chapters without a map, for a free learner with chapters whose lessons aren't written yet"
      )
  }

  /// "9 of 24 chapter maps ready · 5 on the way"
  private var progress: String {
    let total = maps.chapters.count { $0.status != .unavailable && $0.status != .plusRequired }
    let ready = maps.chapters.count { $0.status == .ready }
    let onTheWay = maps.chapters.count { $0.status.isOnItsWay }

    let readyLine = String(
      localized: "\(ready) of \(total) chapter maps ready", table: "MindMaps",
      comment: "How many of the goal's chapter maps are made")

    guard onTheWay > 0 else {
      return readyLine
    }

    return [
      readyLine,
      String(
        localized: "\(onTheWay) on the way", table: "MindMaps",
        comment: "How many chapter maps are being made now"),
    ].joinedFacts()
  }

  private func offerLine(_ offer: MindMapCreateOffer) -> String {
    offer.startable == offer.eligible
      ? String(
        localized: "\(offer.eligible) maps remain. You can leave while they're made.",
        table: "MindMaps", comment: "Over the button that makes every remaining chapter map")
      : String(
        localized: "Starts in course order, within your current allowance.", table: "MindMaps",
        comment: "Over the button that makes only some chapter maps, as many as the allowance lets")
  }
}

// MARK: - Lessons

private struct MindMapLessonsTab: View {
  let goalId: String
  let maps: GoalMindMaps

  var body: some View {
    if maps.lessonGroups.isEmpty {
      EmptyTab {
        Text(
          "No lesson maps yet", tableName: "MindMaps",
          comment: "The Lessons tab before any lesson map")
      } description: {
        Text(
          "Each lesson ends with a small map of its ideas. They show here once your lessons are written.",
          tableName: "MindMaps", comment: "The Lessons tab before any lesson map")
      }
    } else {
      let groups = maps.lessonGroups.compactMap { group in
        maps.chapter(group.chapterId).map { LessonGroupItem(group: group, chapter: $0) }
      }

      MindMapIndex(items: groups, subject: \.chapter.subject) { item in
        LessonGroupRow(item: item)
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

  let item: LessonGroupItem

  var body: some View {
    Button {
      if item.group.opens > 0 {
        router.open(
          .mindMapStudy(tab: .lessons, start: MindMapPosition(chapterId: item.group.chapterId)))
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

  /// "Chapter 5 · 6 lesson maps", with how many are Plus's when access is mixed.
  private var facts: String {
    var facts = [
      String(
        localized: "Chapter \(item.chapter.position)", table: "MindMaps",
        comment: "A chapter's number"),
      String(
        localized: "\(item.group.count) lesson maps", table: "MindMaps",
        comment: "How many of a chapter's lessons have a map"),
    ]

    if item.group.locked > 0 {
      facts.append(
        String(
          localized: "\(item.group.locked) locked", table: "MindMaps",
          comment: "How many of a chapter's lesson maps open only with Plus"))
    }

    return facts.joinedFacts()
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

    MindMapIndex(items: items, subject: \.chapter?.subject) { item in
      SavedRow(goalId: goalId, item: item)
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
            Text(save.title)
              .typeStyle(.rowTitle)
              .foregroundStyle(.mutedForeground)
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
          tab: .saved,
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
    .savesMindMap(target, goalId: goalId, server: true)
  }

  private var thumbnail: URL? {
    item.chapter?.image.flatMap { URL(string: $0.thumbnailUrl ?? $0.url) }
  }

  private var facts: String {
    var facts: [String] = []

    if let chapter = item.chapter {
      facts.append(
        String(
          localized: "Chapter \(chapter.position)", table: "MindMaps",
          comment: "A chapter's number"))
    }

    if item.save.kind == .lesson {
      facts.append(String(localized: LessonMapView.name))
    }

    return facts.joinedFacts()
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
              Text(verbatim: group.items.count.formatted())
            }
          }
        }
        .id(group.key)
      }
    } else if hasSubjects {
      ForEach(groups, id: \.key) { group in
        Section {
          DisclosureGroup(isExpanded: $unfolded.contains(group.key)) {
            ForEach(group.items) { row($0) }
          } label: {
            SectionTitle(Text(group.subject?.name ?? "")) {
              Text(verbatim: group.items.count.formatted())
            }
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
