import XCTest

@testable import Zoonk

final class MindMapDeckTests: XCTestCase {
  func testLessonMapsNotReadYetHoldTheirPlacesAndLockedOnesAreLeftOut() {
    let maps = Self.maps(groups: [
      LessonMapGroup(chapterId: "c1", count: 2, locked: 0),
      LessonMapGroup(chapterId: "c2", count: 3, locked: 3),
      LessonMapGroup(chapterId: "c3", count: 3, locked: 1),
    ])

    let cards = MindMapDeck.cards(
      tab: .lessons, maps: maps, lessons: ["c1": Self.lessons("c1", ["l1", "l2"], locked: [])])

    XCTAssertEqual(
      cards,
      [
        .lesson(chapterId: "c1", lessonId: "l1"), .lesson(chapterId: "c1", lessonId: "l2"),
        .pendingLesson(chapterId: "c3", index: 0), .pendingLesson(chapterId: "c3", index: 1),
      ])
  }

  func testTheSavedDeckHoldsOnlyMapsThatOpen() {
    let maps = Self.maps(
      chapters: [Self.chapter("c1", .ready), Self.chapter("c2", .available)],
      saved: [
        SavedMindMap(available: true, chapterId: "c1", kind: .chapter, targetId: "c1", title: "1"),
        SavedMindMap(available: true, chapterId: "c2", kind: .chapter, targetId: "c2", title: "2"),
        SavedMindMap(available: true, chapterId: "c1", kind: .lesson, targetId: "l1", title: "3"),
        SavedMindMap(available: false, chapterId: nil, kind: .lesson, targetId: "l9", title: "4"),
      ])

    XCTAssertEqual(
      MindMapDeck.cards(tab: .saved, maps: maps, lessons: [:]),
      [.chapter(chapterId: "c1"), .lesson(chapterId: "c1", lessonId: "l1")])
  }

  func testADeckOpensAtTheMapThenItsChapterThenTheFirst() {
    let cards: [MindMapCard] = [
      .chapter(chapterId: "c1"), .pendingLesson(chapterId: "c2", index: 0),
      .lesson(chapterId: "c3", lessonId: "l5"),
    ]

    XCTAssertEqual(
      MindMapDeck.start(
        in: cards,
        at: MindMapPosition(chapterId: "c3", key: MindMapKey(kind: .lesson, targetId: "l5"))),
      .lesson(chapterId: "c3", lessonId: "l5"))
    XCTAssertEqual(
      MindMapDeck.start(
        in: cards,
        at: MindMapPosition(chapterId: "c2", key: MindMapKey(kind: .lesson, targetId: "l2"))),
      .pendingLesson(chapterId: "c2", index: 0))
    XCTAssertEqual(
      MindMapDeck.start(in: cards, at: MindMapPosition(chapterId: "gone")),
      .chapter(chapterId: "c1"))
    XCTAssertEqual(MindMapDeck.start(in: cards, at: nil), .chapter(chapterId: "c1"))
  }

  func testAPlaceNotReadYetBecomesItsMapOnceTheChapterIsRead() {
    let cards: [MindMapCard] = [
      .lesson(chapterId: "c2", lessonId: "l1"), .lesson(chapterId: "c2", lessonId: "l2"),
    ]

    XCTAssertEqual(
      MindMapDeck.resolve(.pendingLesson(chapterId: "c2", index: 1), in: cards),
      .lesson(chapterId: "c2", lessonId: "l2"))
    // The chapter has fewer maps than the list counted.
    XCTAssertEqual(
      MindMapDeck.resolve(.pendingLesson(chapterId: "c2", index: 4), in: cards),
      .lesson(chapterId: "c2", lessonId: "l2"))
    XCTAssertNil(MindMapDeck.resolve(.pendingLesson(chapterId: "c9", index: 0), in: cards))
  }

  private static func maps(
    chapters: [ChapterMindMap] = [], groups: [LessonMapGroup] = [], saved: [SavedMindMap] = []
  ) -> GoalMindMaps {
    GoalMindMaps(
      chapters: chapters,
      createOffer: MindMapCreateOffer(eligible: 0, needLessons: 0, startable: 0, stop: nil),
      firstTab: .chapters, lessonGroups: groups, saved: saved)
  }

  private static func chapter(_ id: String, _ status: ChapterMindMap.Status) -> ChapterMindMap {
    ChapterMindMap(
      chapterId: id, image: nil, lessonsToWrite: 0, outline: nil, position: 1, saved: false,
      status: status, subject: nil, title: id)
  }

  private static let summary = try? JSONDecoder().decode(
    LessonSummary.self, from: Data(#"{"shape":"hub","ideas":[]}"#.utf8))

  private static func lessons(_ chapterId: String, _ ids: [String], locked: Set<String>)
    -> ChapterLessonMaps
  {
    ChapterLessonMaps(
      chapter: .init(id: chapterId, position: 1, title: chapterId),
      lessons: ids.enumerated().map { index, id in
        ChapterLessonMaps.Lesson(
          lessonId: id, locked: locked.contains(id),
          map: locked.contains(id) ? nil : summary,
          position: index + 1, saved: false, title: id)
      })
  }
}
