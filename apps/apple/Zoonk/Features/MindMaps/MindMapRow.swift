import SwiftUI

/// Main's map row, the same wherever a chapter's map shows: on the chapter's page, where the
/// chapter ends, and on the Mind maps page. Only a tap makes a map; one on its way is followed
/// until it's done.
struct MindMapRow: View {
  enum Place {
    /// The chapter's page, where the row is the chapter's "Mind map".
    case chapter
    /// Where the chapter ends, named after it.
    case finish
    /// The Mind maps page, named after the chapter, with its number.
    case library
  }

  private enum Shown {
    case create, writingLessons, drawing, ready, failed, unreachable, plusRequired
  }

  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(MindMapsStore.self) private var store
  @State private var failure: MindMapRequestFailure?

  let goalId: String
  let map: ChapterMindMap
  let place: Place

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if place == .library, shown == .ready {
        Button(action: open) {
          row.disclosureChevron()
        }
      } else if place == .library, shown == .plusRequired {
        // The page's notice has the one See Plus; the row leads to the same place.
        Button {
          router.present(.subscription)
        } label: {
          row
        }
      } else {
        row
      }

      if case .refused(let refusal) = failure {
        HelpLimitNotice(limit: refusal.limit, message: refusal.message)
          .controlSize(.small)
      }
    }
    .announcesStatus(waitLine)
    // Read only: a map on its way when the row showed, or once a tap started it, is followed
    // until its status changes or the connection drops.
    .task(id: map.status.isOnItsWay && failure == nil) {
      if map.status.isOnItsWay, failure == nil {
        failure = await store.follow(goalId: goalId, chapterId: map.chapterId)
      }
    }
  }

  private var row: some View {
    MarkedRow(alignment: .center) {
      slot
    } content: {
      words
    } end: {
      action
    }
  }

  private var shown: Shown {
    if store.requesting.contains(map.chapterId) {
      return map.lessonsToWrite > 0 ? .writingLessons : .drawing
    }

    switch map.status {
    case .ready: return .ready
    case .plusRequired: return .plusRequired
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
        case .plusRequired:
          Image(systemName: "lock")
            .foregroundStyle(.mutedForeground)
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
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        title
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))

        if shown == .plusRequired, place != .library {
          PlusMark()
        }
      }

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
    case .finish, .library:
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
    case .library:
      // The page says once what writing a chapter's lessons first means.
      let words: String? =
        switch shown {
        case .create where map.lessonsToWrite > 0:
          String(
            localized: "Lessons not written yet", table: "MindMaps",
            comment: "A chapter on the mind maps page whose lessons a map would write first")
        case .ready where map.image == nil:
          String(
            localized: "As text", table: "MindMaps",
            comment: "A map on the mind maps page whose picture failed, so it opens as its outline")
        case .plusRequired:
          String(
            localized: "Plus", table: "Subscriptions",
            comment: "Mark on a feature that comes with Zoonk Plus")
        case .create, .ready: nil
        default: waitLine ?? stateLine(ready: nil)
        }

      return [
        [
          String(
            localized: "Chapter \(map.position)", table: "MindMaps", comment: "A chapter's number"),
          words,
        ].compactMap(\.self).joinedFacts()
      ]
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
          localized: "Its lessons get written first, so it takes a few minutes.", table: "MindMaps",
          comment: "A Plus learner's map of a chapter whose lessons aren't written yet")
        : String(
          localized: "Its lessons get written first and count toward your free lessons.",
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
    case .plusRequired:
      return Self.mainIdeas
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
    case .create:
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
    case .ready where place != .library:
      Button(action: open) {
        Text("Open", tableName: "MindMaps", comment: "Opens the chapter's mind map")
      }
      .buttonStyle(.outline)
      .controlSize(.small)
    case .plusRequired where place != .library:
      SeePlusButton()
        .buttonStyle(.outline)
        .controlSize(.small)
    case .ready, .plusRequired, .writingLessons, .drawing:
      EmptyView()
    }
  }

  private func create() {
    failure = nil

    Task {
      failure = await store.create(goalId: goalId, chapterId: map.chapterId)
    }
  }

  private func open() {
    router.open(.mindMap(chapterId: map.chapterId))
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
  /// Main's `MindMapLimitNotice` words: what ran out and when it comes back. The day's AI spend
  /// keeps the help notice's own words.
  var message: String? {
    guard resource != .aiSpend else {
      return nil
    }

    switch limit {
    case .slowDown:
      return String(
        localized: "Take a short break, then try again.", table: "MindMaps",
        comment: "Fair use asks the learner to wait a moment before another map")
    case .signUpRequired:
      return String(
        localized: "Create your free account to continue.", table: "MindMaps",
        comment: "A guest must create an account to make a map")
    case .limitReached(let period, let tier):
      return resource == .lessons ? Self.lessons(period, tier) : Self.maps(period, tier)
    }
  }

  private static func maps(_ period: HelpLimit.Period, _ tier: LearnerTier) -> String {
    switch (tier, period) {
    case (.guest, _):
      String(
        localized:
          "You've made the mind map you can try without an account. Create a free account to make more.",
        table: "MindMaps", comment: "A guest made the one map they can without an account")
    case (.plus, _):
      String(
        localized: "That's all the new mind maps for today. You can make more tomorrow.",
        table: "MindMaps", comment: "A Plus learner made today's maps")
    case (.free, .month):
      String(
        localized:
          "That's all the new mind maps for this month. You can make more next month, or get Plus to keep going now.",
        table: "MindMaps", comment: "A free learner made this month's maps")
    case (.free, _):
      String(
        localized:
          "That's all the new mind maps for today. You can make more tomorrow, or get Plus to keep going now.",
        table: "MindMaps", comment: "A free learner made today's maps")
    }
  }

  /// A map whose lessons aren't written writes them first, and they count as new lessons.
  private static func lessons(_ period: HelpLimit.Period, _ tier: LearnerTier) -> String {
    switch (tier, period) {
    case (.guest, _):
      String(
        localized:
          "You've taken the lessons you can try without an account. Create a free account to keep going.",
        table: "MindMaps",
        comment: "A guest's map needs new lessons, and they used the ones they can try")
    case (.plus, _):
      String(
        localized: "That's all the new lessons for today. They open again tomorrow.",
        table: "MindMaps",
        comment: "A Plus learner's map needs new lessons, and they started today's")
    case (.free, .month):
      String(
        localized:
          "That's all the new lessons for this month. They open again next month, or get Plus to keep going now.",
        table: "MindMaps",
        comment: "A free learner's map needs new lessons, and they started this month's")
    case (.free, _):
      String(
        localized:
          "That's all the new lessons for today. They open again tomorrow, or get Plus to keep going now.",
        table: "MindMaps",
        comment: "A free learner's map needs new lessons, and they started today's")
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
        if loadsMap {
          row.loads(map, refreshable: false)
        } else {
          row
        }
      } header: {
        header
      }
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
