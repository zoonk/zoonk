import SwiftUI

/// Main's study reader: a tab's maps one per screen, in syllabus order, from the tapped map or where
/// this device last was. The deck is the one the page showed when it opened; a map saved or made
/// meanwhile doesn't move it. The last map's Next is Done.
struct MindMapReader: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(MindMapsStore.self) private var store

  let tab: GoalMindMaps.Tab
  let start: MindMapPosition?

  @State private var maps: GoalMindMaps?
  @State private var current: MindMapCard?
  @State private var zoomed: ZoomedMap?

  var body: some View {
    NavigationStack {
      Group {
        if let goal = learner.summary.value?.shownGoal {
          let list = store.list(goalId: goal.id)

          Group {
            if let maps {
              deck(maps, goalId: goal.id)
            } else if case .failed = list.state {
              unreachable { Task { await list.refresh() } }
            } else {
              ProgressView()
            }
          }
          .loads(list, refreshable: false)
          .onChange(of: list.value, initial: true) { _, value in
            if maps == nil, let value {
              open(value, goalId: goal.id)
            }
          }
          .mindMapSaveFailureAlert(goalId: goal.id)
        }
      }
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
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
    }
    .fullScreenCover(item: $zoomed) { map in
      MindMapZoom(map: map)
        .zoonkStyles()
    }
  }

  private func open(_ value: GoalMindMaps, goalId: String) {
    maps = value
    current = MindMapDeck.start(
      in: MindMapDeck.cards(tab: tab, maps: value),
      at: start ?? store.position(goalId: goalId, tab: tab))
  }

  @ViewBuilder
  private func deck(_ maps: GoalMindMaps, goalId: String) -> some View {
    let cards = MindMapDeck.cards(tab: tab, maps: maps)
    let index = current.flatMap { cards.firstIndex(of: $0) }

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
      ScrollView(.horizontal) {
        LazyHStack(spacing: 0) {
          ForEach(cards, id: \.self) { card in
            page(card, maps: maps, goalId: goalId)
              .containerRelativeFrame(.horizontal)
          }
        }
        .scrollTargetLayout()
      }
      .scrollTargetBehavior(.paging)
      .scrollPosition(id: $current)
      .scrollIndicators(.hidden)
      // The chapter of the map shown and the next one, read ahead.
      .loads(lessonResources(cards, around: index, goalId: goalId), refreshable: false)
      .onChange(of: current, initial: true) { _, card in
        if let card {
          store.remember(MindMapPosition(card), goalId: goalId, tab: tab)
        }
      }
      .navigationTitle(title(current, maps: maps, goalId: goalId))
      .navigationSubtitle(context(current, maps: maps, goalId: goalId))
      .toolbar {
        ToolbarItem(placement: .primaryAction) {
          menu(cards, maps: maps)
        }

        bottomBar(cards, index: index ?? 0, maps: maps, goalId: goalId)
      }
    }
  }

  private func lessonResources(_ cards: [MindMapCard], around index: Int?, goalId: String)
    -> [any CachedResource]
  {
    guard tab != .chapters, let index else {
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
  private func page(_ card: MindMapCard, maps: GoalMindMaps, goalId: String) -> some View {
    switch card {
    case .chapter(let chapterId):
      if let map = maps.chapter(chapterId) {
        ChapterMapPage(map: map) { image in
          zoomed = ZoomedMap(url: image, title: map.title)
        }
      }
    case .lesson(let chapterId, let lessonId):
      let lessons = store.lessonMaps(goalId: goalId, chapterId: chapterId)

      if let lesson = lessons.value?.lessons.first(where: { $0.lessonId == lessonId }),
        let summary = lesson.map
      {
        ZoonkList {
          Section {
            LessonMapView(title: lesson.title, summary: summary)
              .listRowSeparator(.hidden)
          }
        }
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

  private func menu(_ cards: [MindMapCard], maps: GoalMindMaps) -> some View {
    Menu {
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
    } label: {
      Label {
        Text("More options", tableName: "MindMaps", comment: "The reader's menu")
      } icon: {
        Image(systemName: "ellipsis")
      }
    }
  }

  /// Previous, "5 of 12", Save and Next under the thumb; the last map's Next is Done.
  @ToolbarContentBuilder
  private func bottomBar(
    _ cards: [MindMapCard], index: Int, maps: GoalMindMaps, goalId: String
  ) -> some ToolbarContent {
    ToolbarItemGroup(placement: .bottomBar) {
      Button {
        move(to: cards[max(0, index - 1)])
      } label: {
        Label {
          Text("Previous", tableName: "MindMaps", comment: "Goes to the deck's previous map")
        } icon: {
          Image(systemName: "chevron.backward")
        }
      }
      .disabled(index == 0)
      .keyboardShortcut(.leftArrow, modifiers: [])

      Spacer()

      Text(
        "\(index + 1) of \(cards.count)", tableName: "MindMaps", comment: "Which map of the deck"
      )
      .typeStyle(.data)
      .monospacedDigit()
      .foregroundStyle(.mutedForeground)
      .fixedSize()

      Spacer()

      if let current, let target = saveTarget(current, maps: maps, goalId: goalId) {
        MindMapSaveButton(target: target.target, goalId: goalId, server: target.server)
          .keyboardShortcut("s", modifiers: [])
      }

      if index == cards.count - 1 {
        Button {
          dismiss()
        } label: {
          Text("Done", tableName: "MindMaps", comment: "Closes the reader after the last map")
        }
      } else {
        Button {
          move(to: cards[index + 1])
        } label: {
          Label {
            Text("Next", tableName: "MindMaps", comment: "Goes to the deck's next map")
          } icon: {
            Image(systemName: "chevron.forward")
          }
        }
        .keyboardShortcut(.rightArrow, modifiers: [])
      }
    }
  }

  private func move(to card: MindMapCard?) {
    withAnimation(reduceMotion ? nil : .snappy) {
      current = card
    }
  }

  /// What the reader saves, with what the maps read now says of it.
  private func saveTarget(_ card: MindMapCard, maps: GoalMindMaps, goalId: String)
    -> (target: SaveTarget, server: Bool)?
  {
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

  private func title(_ card: MindMapCard?, maps: GoalMindMaps, goalId: String) -> String {
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

  private func context(_ card: MindMapCard?, maps: GoalMindMaps, goalId: String) -> String {
    guard let card, let chapter = maps.chapter(card.chapterId) else {
      return ""
    }

    let chapterLine = String(
      localized: "Chapter \(chapter.position)", table: "MindMaps", comment: "A chapter's number")

    guard case .lesson(let chapterId, let lessonId) = card,
      let lesson = store.lessonMaps(goalId: goalId, chapterId: chapterId).value?.lessons.first(
        where: { $0.lessonId == lessonId })
    else {
      return chapterLine
    }

    return [
      chapterLine,
      String(
        localized: "Lesson \(lesson.position)", table: "MindMaps",
        comment: "A lesson's number in its chapter"),
    ].joinedFacts()
  }
}

/// A chapter's map: its picture, then its outline, in one scroll; side by side where the screen
/// has room for two pages or an open book. Tapping the picture zooms it.
private struct ChapterMapPage: View {
  let map: ChapterMindMap
  let zoom: (URL) -> Void

  var body: some View {
    let url = map.image.flatMap { URL(string: $0.url) }

    if let outline = map.outline {
      PaneSplit {
        if let url {
          ScrollView {
            picture(url)
              .scenePadding()
          }
        }
      } secondary: {
        MindMapOutlineView(outline: outline) { EmptyView() }
      } single: {
        MindMapOutlineView(outline: outline) {
          if let url {
            Section {
              picture(url)
                .listRowSeparator(.hidden)
            }
          }
        }
      }
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
  let title: String

  var id: URL { url }
}

/// The existing zoom viewer over the reader, which keeps the deck's swipes and keys until it
/// closes.
private struct MindMapZoom: View {
  @Environment(\.dismiss) private var dismiss

  let map: ZoomedMap

  var body: some View {
    NavigationStack {
      ZoomableRemoteImage(url: map.url, title: map.title)
        .ignoresSafeArea(edges: .bottom)
        .navigationTitle(map.title)
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
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
    }
  }
}
