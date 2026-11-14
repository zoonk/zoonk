import SwiftUI

/// Main's map row, the same wherever a chapter's map shows: on the chapter's page, where the
/// chapter ends, and on the Mind maps page. Only a tap makes a map; one on its way is followed
/// until it's done.
struct MindMapRow: View {
  enum Place: Equatable {
    /// The chapter's page, where the row is the chapter's "Mind map".
    case chapter
    /// Where the chapter ends, named after it.
    case finish
    /// The Mind maps page's index, named after the chapter, with its number.
    case library
    /// The Mind maps page's "Not made yet" list. It mixes subjects without their headers, so a
    /// row goes by its title alone, and it offers Create only while a new map can start.
    case notMade(canStart: Bool)

    /// The Mind maps page, which follows every map on its way itself.
    var isMindMapsPage: Bool {
      switch self {
      case .library, .notMade: true
      case .chapter, .finish: false
      }
    }
  }

  private enum Shown {
    case create, writingLessons, drawing, ready, failed, unreachable
  }

  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(MindMapsStore.self) private var store

  let goalId: String
  let map: ChapterMindMap
  let place: Place

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if place.isMindMapsPage, shown == .ready {
        Button(action: open) {
          row.disclosureChevron()
        }
      } else {
        row
      }

      if case .refused(let refusal) = failure {
        LimitNotice(limit: refusal.limit, words: refusal.words(now:))
          .controlSize(.small)
      }
    }
    .announcesStatus(waitLine)
    // Read only: a map on its way when the row showed, or once a tap started it, is followed
    // until its status changes or the connection drops; a newer read of the map starts it again.
    // The Mind maps page follows its whole list instead.
    .task(id: !place.isMindMapsPage && map.status.isOnItsWay && failure == nil) {
      if !place.isMindMapsPage, map.status.isOnItsWay, failure == nil {
        await store.follow(goalId: goalId, chapterId: map.chapterId)
      }
    }
    .savesMindMap(
      SaveTarget(
        key: MindMapKey(kind: .chapter, targetId: map.chapterId), title: map.title,
        chapterId: map.chapterId), goalId: goalId, server: map.saved,
      isAvailable: place.isMindMapsPage && shown == .ready)
  }

  private var failure: MindMapRequestFailure? {
    store.failure(goalId: goalId, chapterId: map.chapterId)
  }

  private var row: some View {
    MarkedRow(alignment: .center) {
      slot
    } content: {
      words
    } end: {
      HStack(spacing: 12) {
        if place.isMindMapsPage, shown == .ready,
          store.isSaved(MindMapKey(kind: .chapter, targetId: map.chapterId), server: map.saved)
        {
          SavedMark()
        }

        action
      }
    }
  }

  private var shown: Shown {
    if store.requesting.contains(map.chapterId) {
      return map.lessonsToWrite > 0 ? .writingLessons : .drawing
    }

    switch map.status {
    case .ready: return .ready
    case _ where failure == .unreachable: return .unreachable
    case .writingLessons: return .writingLessons
    case .drawing: return .drawing
    case .failed: return .failed
    case .available, .unavailable: return .create
    }
  }

  @ViewBuilder
  private var slot: some View {
    if shown == .ready, let thumbnail {
      MindMapSlot(picture: thumbnail)
    } else {
      MindMapSlot {
        switch shown {
        case .writingLessons, .drawing:
          ProgressView()
        default:
          KindMark(kind: .mindMap)
        }
      }
    }
  }

  private var thumbnail: URL? {
    map.image.flatMap { URL(string: $0.thumbnailUrl ?? $0.url) }
  }

  private var words: some View {
    VStack(alignment: .leading, spacing: 2) {
      title
        .typeStyle(.rowTitle)
        .foregroundStyle(Color(.foreground))

      ForEach(lines, id: \.self) { line in
        Text(line)
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
    }
    .accessibilityElement(children: .combine)
  }

  /// On the chapter's page a map on its way says so in place of "Mind map", as main's row does.
  private var title: Text {
    switch place {
    case .chapter:
      if let waitLine {
        return Text(waitLine)
      }

      return Text("Mind map", tableName: "MindMaps", comment: "A chapter's mind map, on its page")
    case .finish, .library, .notMade:
      return Text(map.title)
    }
  }

  private var lines: [String] {
    switch place {
    case .chapter:
      return [waitDetail ?? stateLine(ready: Self.mainIdeas)].compactMap(\.self)
    case .finish:
      if let waitLine, let waitDetail {
        return [waitLine, waitDetail]
      }

      return [
        stateLine(
          ready: String(
            localized: "Mind map ready", table: "MindMaps",
            comment: "A finished chapter's map, drawn and ready to open"))
      ].compactMap(\.self)
    case .library, .notMade:
      // The page says once what writing a chapter's lessons first means.
      let words: String? =
        switch shown {
        case .create where map.lessonsToWrite > 0:
          String(
            localized: "\(map.lessonsToWrite) lessons to write", table: "MindMaps",
            comment: "A chapter on the mind maps page whose lessons a map would write first")
        case .ready where map.image == nil:
          String(
            localized: "As text", table: "MindMaps",
            comment: "A map on the mind maps page whose picture failed, so it opens as its outline")
        case .create, .ready: nil
        default: waitLine ?? stateLine(ready: nil)
        }

      let number =
        place == .library
        ? String(
          localized: "Chapter \(map.position)", table: "MindMaps", comment: "A chapter's number")
        : nil

      return [[number, words].compactMap(\.self).joinedFacts()]
    }
  }

  /// What a row that isn't on its way says, with `ready` for a drawn map.
  private func stateLine(ready: String?) -> String? {
    switch shown {
    case .create:
      if map.lessonsToWrite == 0 {
        return Self.mainIdeas
      }

      return learner.summary.value?.tier == .plus
        ? String(
          localized: "\(map.lessonsToWrite) lessons get written first, so it takes a few minutes.",
          table: "MindMaps",
          comment: "A Plus learner's map of a chapter whose lessons aren't written yet")
        : String(
          localized:
            "\(map.lessonsToWrite) lessons get written first and count toward your free lessons.",
          table: "MindMaps",
          comment: "A free learner's map of a chapter whose lessons aren't written yet")
    case .ready:
      if map.image == nil {
        return String(
          localized: "Its picture had mistakes, so here's the mind map as text.", table: "MindMaps",
          comment: "A map whose picture failed its check, shown as its outline")
      }

      return ready
    case .failed:
      return String(
        localized: "It couldn't be made this time.", table: "MindMaps",
        comment: "A map that failed")
    case .unreachable:
      return String(
        localized: "We couldn't reach the server. Check your connection.", table: "MindMaps",
        comment: "Asking for a map didn't reach the server")
    case .writingLessons, .drawing:
      return nil
    }
  }

  private var waitLine: String? {
    switch shown {
    case .writingLessons:
      String(
        localized: "Writing the lessons, then the mind map…", table: "MindMaps",
        comment: "A map whose chapter's lessons are written first")
    case .drawing:
      String(localized: "Drawing the mind map…", table: "MindMaps", comment: "A map being drawn")
    default:
      nil
    }
  }

  private var waitDetail: String? {
    switch shown {
    case .writingLessons:
      String(
        localized: "This takes a few minutes. You can leave; it'll be here.", table: "MindMaps",
        comment: "Under a map whose chapter's lessons are written first")
    case .drawing:
      String(
        localized: "About half a minute. You can leave; it'll be here.", table: "MindMaps",
        comment: "Under a map being drawn")
    default:
      nil
    }
  }

  private static let mainIdeas = String(
    localized: "Its main ideas in one picture", table: "MindMaps",
    comment: "What a chapter's mind map is")

  @ViewBuilder
  private var action: some View {
    switch shown {
    case .create where place != .notMade(canStart: false):
      Button(action: create) {
        Text("Create", tableName: "MindMaps", comment: "Makes the chapter's mind map")
      }
      .buttonStyle(.outline)
      .controlSize(.small)
    case .failed, .unreachable:
      Button(action: create) {
        Text("Try again", tableName: "MindMaps", comment: "Makes a failed map again")
      }
      .buttonStyle(.outline)
      .controlSize(.small)
    case .ready where !place.isMindMapsPage:
      Button(action: open) {
        Text("Open", tableName: "MindMaps", comment: "Opens the chapter's mind map")
      }
      .buttonStyle(.outline)
      .controlSize(.small)
    case .create, .ready, .writingLessons, .drawing:
      EmptyView()
    }
  }

  private func create() {
    Task {
      await store.create(goalId: goalId, chapterId: map.chapterId)
    }
  }

  /// From the Mind maps page, into its Chapters deck at this map.
  private func open() {
    if place.isMindMapsPage {
      router.open(
        .mindMapStudy(
          goalId: goalId, tab: .chapters,
          start: MindMapPosition(
            chapterId: map.chapterId, key: MindMapKey(kind: .chapter, targetId: map.chapterId))))
    } else {
      router.open(.mindMap(goalId: goalId, chapterId: map.chapterId))
    }
  }
}

/// The row's leading square: the map's thumbnail once it's drawn, otherwise a dashed slot.
struct MindMapSlot<Mark: View>: View {
  private let picture: URL?
  @ViewBuilder private let mark: Mark

  init(@ViewBuilder mark: () -> Mark) {
    picture = nil
    self.mark = mark()
  }

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Radius.md, style: .continuous)

    Group {
      if let picture {
        AsyncImage(url: picture) { image in
          image.resizable().scaledToFill()
        } placeholder: {
          Color.muted
        }
        .clipShape(shape)
        .overlay(shape.strokeBorder(.border))
      } else {
        shape
          .strokeBorder(.input, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
          .overlay { mark }
      }
    }
    .frame(width: 48, height: 48)
    // The square keeps its size, so what's drawn in it does too.
    .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    .accessibilityHidden(true)
  }
}

extension MindMapSlot where Mark == EmptyView {
  init(picture: URL) {
    self.picture = picture
    mark = EmptyView()
  }
}

extension MindMapLimit {
  /// Main's `MindMapLimitNotice` words: the maps, the lessons a map writes first (which count as
  /// new lessons), or the day's AI spend.
  func words(now: Date = .now) -> LimitWords {
    switch resource {
    case .aiSpend: limit.helpWords(now: now)
    case .chapterLessons: limit.mapLessonsWords(now: now)
    case .lessons: limit.lessonWords(now: now)
    case .mindMap: limit.mindMapWords
    }
  }
}

/// Main's finish moment: once a write finished a chapter, "Chapter finished" and the row of its map,
/// after the day's moment. Continue never waits for it.
struct FinishedChapterSection: View {
  @Environment(MindMapsStore.self) private var store

  let chapter: Components.Schemas.FinishedChapter

  var body: some View {
    MindMapRowSection(
      goalId: chapter.goalId, map: store.map(goalId: chapter.goalId, chapterId: chapter.chapterId),
      place: .finish, placeholder: Text(chapter.title), loadsMap: true
    ) {
      SectionTitle(
        Text(
          "Chapter finished", tableName: "MindMaps",
          comment: "Over the map of the chapter the learner just finished"))
    }
  }
}

/// A chapter's map row read on its own, as on the chapter's page and where the chapter ends. Its
/// title and slot hold its place while it loads, so nothing under it moves; a chapter that gets no
/// map leaves no row.
struct MindMapRowSection<Header: View>: View {
  let goalId: String
  let map: Resource<ChapterMindMap>
  let place: MindMapRow.Place
  let placeholder: Text
  /// Where the screen doesn't load the map itself.
  var loadsMap = false
  @ViewBuilder let header: Header

  var body: some View {
    if map.value?.status != .unavailable {
      Section {
        MindMapRowContent(
          goalId: goalId, map: map, place: place, placeholder: placeholder, loadsMap: loadsMap)
      } header: {
        header
      }
    }
  }
}

/// The row inside a section of its own or one it shares, as the chapter page's "For reference"
/// beside a wide page.
struct MindMapRowContent: View {
  let goalId: String
  let map: Resource<ChapterMindMap>
  let place: MindMapRow.Place
  let placeholder: Text
  var loadsMap = false

  var body: some View {
    if loadsMap {
      row.loads(map, refreshable: false)
    } else {
      row
    }
  }

  @ViewBuilder
  private var row: some View {
    if let value = map.value {
      MindMapRow(goalId: goalId, map: value, place: place)
    } else {
      MarkedRow(alignment: .center) {
        MindMapSlot {
          if case .failed = map.state {
            KindMark(kind: .mindMap)
          } else {
            ProgressView()
          }
        }
      } content: {
        placeholder
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))
      } end: {
        if case .failed = map.state {
          Button {
            Task { await map.refresh() }
          } label: {
            Text("Try again", tableName: "MindMaps", comment: "Retries")
          }
          .buttonStyle(.outline)
          .controlSize(.small)
        }
      }
    }
  }
}

extension MindMapRowSection where Header == EmptyView {
  init(goalId: String, map: Resource<ChapterMindMap>, place: MindMapRow.Place, placeholder: Text) {
    self.init(goalId: goalId, map: map, place: place, placeholder: placeholder) { EmptyView() }
  }
}
