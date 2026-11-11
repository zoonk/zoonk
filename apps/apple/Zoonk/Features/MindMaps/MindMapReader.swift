import SwiftUI

/// Main's study reader: a goal's tab of maps one per screen, in syllabus order, from the tapped map
/// or where this device last was, in the lesson player's chrome. The deck is the one the page showed
/// when it opened; a map saved or made meanwhile, or a goal switched in another window, doesn't move
/// it. The last map's Next is Done.
struct MindMapReader: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(AppRouter.self) private var router
  @Environment(MindMapsStore.self) private var store

  let goalId: String
  let tab: GoalMindMaps.Tab
  let start: MindMapPosition?

  @State private var maps: GoalMindMaps?
  @State private var current: MindMapCard?
  @State private var zoomed: ZoomedMap?

  var body: some View {
    let list = store.list(goalId: goalId)

    NavigationStack {
      Group {
        if let maps {
          deck(maps)
        } else if case .failed = list.state {
          unreachable { Task { await list.refresh() } }
        } else {
          ProgressView()
        }
      }
      .loads(list, refreshable: false)
      .onChange(of: list.value, initial: true) { _, value in
        if maps == nil, let value {
          open(value)
        }
      }
      .mindMapSaveFailureAlert(goalId: goalId)
      .toolbarTitleDisplayMode(.inline)
      .taskClose {
        Button(role: .close) {
          dismiss()
        } label: {
          Label {
            Text("Close", tableName: "MindMaps", comment: "Closes the full-screen mind map")
          } icon: {
            Image(systemName: "xmark")
          }
        }
        .keyboardShortcut(.cancelAction)
      }
    }
    .fullScreenCover(item: $zoomed) { map in
      MindMapZoom(map: map, goalId: goalId)
        .zoonkStyles()
    }
  }

  private func open(_ value: GoalMindMaps) {
    maps = value
    current = MindMapDeck.start(
      in: MindMapDeck.cards(tab: tab, maps: value),
      at: start ?? store.position(goalId: goalId, tab: tab))
  }

  @ViewBuilder
  private func deck(_ maps: GoalMindMaps) -> some View {
    let cards = MindMapDeck.cards(tab: tab, maps: maps)
    let index = current.flatMap { cards.firstIndex(of: $0) } ?? 0

    if cards.isEmpty {
      ContentUnavailableView {
        Label {
          Text(
            "No mind maps to study here yet.", tableName: "MindMaps",
            comment: "The reader opened on a tab without maps that open")
        } icon: {
          KindMark(kind: .mindMap)
        }
      }
      .lonePage()
    } else {
      let title = title(current, maps: maps)
      let save = current.flatMap { saveTarget($0, maps: maps) }

      ScrollViewReader { proxy in
        ScrollView(.horizontal) {
          LazyHStack(spacing: 0) {
            ForEach(cards, id: \.self) { card in
              page(card, maps: maps)
                .containerRelativeFrame(.horizontal)
            }
          }
          .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $current)
        .scrollIndicators(.hidden)
        // The position alone opens the deck on its first page under a resumed map's title, and a
        // new width (rotating, resizing) leaves it between pages: both scroll to the map shown.
        .onScrollGeometryChange(for: CGFloat.self, of: \.containerSize.width) { _, _ in
          show(current, with: proxy)
        }
        .task { show(current, with: proxy) }
      }
      // The chapter of the map shown and the next one, read ahead.
      .loads(lessonResources(cards, around: index), refreshable: false)
      .onChange(of: current, initial: true) { _, card in
        if let card {
          store.remember(MindMapPosition(card), goalId: goalId, tab: tab)
        }
      }
      .onKeyPress(.rightArrow) {
        guard index < cards.count - 1 else {
          return .ignored
        }

        move(to: cards[index + 1])
        return .handled
      }
      .safeAreaBar(edge: .bottom) {
        actionBar(cards, index: index)
          .keepsOffFold()
      }
      // Previous is see-through, so a map scrolling under the bar stops at its edge.
      .scrollEdgeEffectStyle(.hard, for: .bottom)
      .navigationTitle(title)
      .announcesStatus(title)
      .taskAction(isShown: save != nil) {
        if let save {
          MindMapSaveButton(target: save.target, goalId: goalId, server: save.server)
            .keyboardShortcut("s", modifiers: [])
        }
      }
      .taskOptions(
        label: Text("More options", tableName: "MindMaps", comment: "The reader's menu")
      ) {
        menuItems(cards)
      }
    }
  }

  private func lessonResources(_ cards: [MindMapCard], around index: Int) -> [any CachedResource] {
    guard tab != .chapters else {
      return []
    }

    var chapters: [String] = []

    for card in cards[index...] where !chapters.contains(card.chapterId) {
      if case .chapter = card {
        continue
      }

      chapters.append(card.chapterId)

      if chapters.count == 2 {
        break
      }
    }

    return chapters.map { store.lessonMaps(goalId: goalId, chapterId: $0) }
  }

  @ViewBuilder
  private func page(_ card: MindMapCard, maps: GoalMindMaps) -> some View {
    switch card {
    case .chapter(let chapterId):
      if let map = maps.chapter(chapterId) {
        ChapterMapPage(map: map) { image in
          zoomed = ZoomedMap(
            url: image,
            target: SaveTarget(
              key: MindMapKey(kind: .chapter, targetId: chapterId), title: map.title,
              chapterId: chapterId))
        }
      }
    case .lesson(let chapterId, let lessonId):
      let lessons = store.lessonMaps(goalId: goalId, chapterId: chapterId)

      if let lesson = lessons.value?.lessons.first(where: { $0.lessonId == lessonId }),
        let summary = lesson.map
      {
        // The lesson player's map, as its last screen shows it, in the player's column.
        ScrollView {
          LessonMapView(title: lesson.title, summary: summary)
            .taskColumn(alignment: .leading)
        }
        .lonePage()
      } else if lessons.value != nil {
        ContentUnavailableView {
          Label {
            Text(
              "This map isn't available anymore.", tableName: "MindMaps",
              comment: "A saved lesson map that's no longer in the goal")
          } icon: {
            KindMark(kind: .mindMap)
          }
        }
        .lonePage()
      } else {
        waiting(lessons)
      }
    }
  }

  @ViewBuilder
  private func waiting(_ lessons: Resource<ChapterLessonMaps>) -> some View {
    if case .failed = lessons.state {
      unreachable { Task { await lessons.refresh() } }
    } else {
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  private func unreachable(retry: @escaping () -> Void) -> some View {
    ContentUnavailableView {
      Label {
        Text(
          "We couldn't reach the server.", tableName: "MindMaps",
          comment: "A map that failed to load")
      } icon: {
        Image(systemName: "wifi.exclamationmark")
      }
    } actions: {
      Button(action: retry) {
        Text("Try again", tableName: "MindMaps", comment: "Retries")
      }
      .buttonStyle(.outline)
    }
    .lonePage()
  }

  @ViewBuilder
  private func menuItems(_ cards: [MindMapCard]) -> some View {
    Button {
      move(to: cards.first)
    } label: {
      Label {
        Text(
          "Start from the first map", tableName: "MindMaps",
          comment: "Goes back to the deck's first map")
      } icon: {
        Image(systemName: "arrow.uturn.backward")
      }
    }
    .disabled(current == cards.first)

    if let current {
      Button {
        router.open(.chapter(chapterId: current.chapterId))
      } label: {
        Label {
          Text("Open chapter", tableName: "MindMaps", comment: "Opens the map's chapter page")
        } icon: {
          Image(systemName: "book.pages")
        }
      }

      if case .lesson(_, let lessonId) = current {
        Button {
          router.open(.lesson(lessonId: lessonId))
        } label: {
          Label {
            Text("Open lesson", tableName: "MindMaps", comment: "Opens the map's lesson")
          } icon: {
            Image(systemName: "play")
          }
        }
      }
    }
  }

  /// The lesson player's bar: Previous from the second map, then Next, which is Done on the last.
  private func actionBar(_ cards: [MindMapCard], index: Int) -> some View {
    let isLast = index == cards.count - 1

    return TaskActionBar {
      if index > 0 {
        StepBackButton(
          label: Text(
            "Previous", tableName: "MindMaps", comment: "Goes to the deck's previous map")
        ) {
          move(to: cards[index - 1])
        }
      }

      BusyButton(isBusy: false, icon: isLast ? .check : .forward) {
        if isLast {
          dismiss()
        } else {
          move(to: cards[index + 1])
        }
      } label: {
        if isLast {
          Text("Done", tableName: "MindMaps", comment: "Closes the reader after the last map")
        } else {
          Text("Next", tableName: "MindMaps", comment: "Goes to the deck's next map")
        }
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
      .buttonSizing(.flexible)
      .keyboardShortcut(.defaultAction)
    }
  }

  private func show(_ card: MindMapCard?, with proxy: ScrollViewProxy) {
    if let card {
      proxy.scrollTo(card)
    }
  }

  private func move(to card: MindMapCard?) {
    withAnimation(reduceMotion ? nil : .snappy) {
      current = card
    }
  }

  /// What the reader saves, with what the maps read now says of it.
  private func saveTarget(_ card: MindMapCard, maps: GoalMindMaps) -> (
    target: SaveTarget, server: Bool
  )? {
    switch card {
    case .chapter(let chapterId):
      guard
        let map = store.list(goalId: goalId).value?.chapter(chapterId) ?? maps.chapter(chapterId)
      else {
        return nil
      }

      return (
        SaveTarget(
          key: MindMapKey(kind: .chapter, targetId: chapterId), title: map.title,
          chapterId: chapterId), map.saved
      )
    case .lesson(let chapterId, let lessonId):
      guard
        let lesson = store.lessonMaps(goalId: goalId, chapterId: chapterId).value?.lessons.first(
          where: { $0.lessonId == lessonId })
      else {
        return nil
      }

      return (
        SaveTarget(
          key: MindMapKey(kind: .lesson, targetId: lessonId), title: lesson.title,
          chapterId: chapterId), lesson.saved
      )
    }
  }

  /// The map's title alone: the lesson's on a lesson map, else its chapter's.
  private func title(_ card: MindMapCard?, maps: GoalMindMaps) -> String {
    guard let card else {
      return ""
    }

    if case .lesson(let chapterId, let lessonId) = card,
      let lesson = store.lessonMaps(goalId: goalId, chapterId: chapterId).value?.lessons.first(
        where: { $0.lessonId == lessonId })
    {
      return lesson.title
    }

    return maps.chapter(card.chapterId)?.title ?? ""
  }
}

/// A chapter's map: its picture, then its outline, in one scroll; side by side where the screen
/// has room for two pages or an open book. Tapping the picture zooms it.
private struct ChapterMapPage: View {
  let map: ChapterMindMap
  let zoom: (URL) -> Void

  var body: some View {
    let url = map.image.flatMap { URL(string: $0.url) }

    if let outline = map.outline, let url {
      PaneSplit {
        ScrollView {
          picture(url)
            .scenePadding()
        }
      } secondary: {
        MindMapOutlineView(outline: outline) { EmptyView() }
      } single: {
        MindMapOutlineView(outline: outline) {
          Section {
            picture(url)
              .listRowSeparator(.hidden)
          }
        }
      }
    } else if let outline = map.outline {
      MindMapOutlineView(outline: outline) {
        Section {
          Text(
            "Its picture had mistakes, so here's the mind map as text.", tableName: "MindMaps",
            comment: "A map whose picture failed its check, shown as its outline"
          )
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
          .listRowSeparator(.hidden)
        }
      }
      .lonePage()
    } else if let url {
      ScrollView {
        picture(url)
          .scenePadding()
      }
    }
  }

  private func picture(_ url: URL) -> some View {
    Button {
      zoom(url)
    } label: {
      AsyncImage(url: url) { image in
        image.resizable().scaledToFit()
      } placeholder: {
        Color.muted
      }
      .aspectRatio(
        CGFloat(map.image?.width ?? 1) / CGFloat(max(1, map.image?.height ?? 1)), contentMode: .fit
      )
      .clipShape(.rect(cornerRadius: Radius.lg, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: Radius.lg, style: .continuous).strokeBorder(.border))
    }
    .buttonStyle(.plain)
    .accessibilityLabel(
      Text(
        "Mind map of \(map.title)", tableName: "MindMaps",
        comment: "Spoken label of a map's picture")
    )
    .accessibilityHint(
      Text(
        "Opens the picture to zoom in.", tableName: "MindMaps",
        comment: "What tapping a map's picture in the reader does"))
  }
}

private struct ZoomedMap: Identifiable {
  let url: URL
  let target: SaveTarget

  var id: URL { url }
}

/// The existing zoom viewer over the reader, which keeps the deck's swipes and keys until it
/// closes. Its bookmark sits where the reader's does.
private struct MindMapZoom: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(MindMapsStore.self) private var store

  let map: ZoomedMap
  let goalId: String

  var body: some View {
    let saved =
      map.target.chapterId.flatMap { store.list(goalId: goalId).value?.chapter($0)?.saved }
      ?? false

    NavigationStack {
      ZoomableRemoteImage(url: map.url, title: map.target.title)
        .ignoresSafeArea(edges: .bottom)
        .navigationTitle(map.target.title)
        .toolbarTitleDisplayMode(.inline)
        .taskClose {
          Button(role: .close) {
            dismiss()
          } label: {
            Label {
              Text("Close", tableName: "MindMaps", comment: "Closes the full-screen mind map")
            } icon: {
              Image(systemName: "xmark")
            }
          }
          .keyboardShortcut(.cancelAction)
        }
        .taskAction {
          MindMapSaveButton(target: map.target, goalId: goalId, server: saved)
            .keyboardShortcut("s", modifiers: [])
        }
        .mindMapSaveFailureAlert(goalId: goalId)
    }
  }
}
