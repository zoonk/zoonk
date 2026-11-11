import XCTest

@testable import Zoonk

final class MindMapDeckTests: XCTestCase {
  func testTheLessonsDeckIsTheLessonsTheListNamedSoMapsWrittenLaterDontMoveIt() {
    let maps = Self.maps(groups: [
      LessonMapGroup(chapterId: "c1", count: 2, locked: 0, lessonIds: ["l2", "l3"]),
      LessonMapGroup(chapterId: "c2", count: 3, locked: 3, lessonIds: []),
      LessonMapGroup(chapterId: "c3", count: 3, locked: 1, lessonIds: ["l5", "l6"]),
    ])

    XCTAssertEqual(
      MindMapDeck.cards(tab: .lessons, maps: maps),
      [
        .lesson(chapterId: "c1", lessonId: "l2"), .lesson(chapterId: "c1", lessonId: "l3"),
        .lesson(chapterId: "c3", lessonId: "l5"), .lesson(chapterId: "c3", lessonId: "l6"),
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
      MindMapDeck.cards(tab: .saved, maps: maps),
      [.chapter(chapterId: "c1"), .lesson(chapterId: "c1", lessonId: "l1")])
  }

  func testADeckOpensAtTheMapThenItsChapterThenTheFirst() {
    let cards: [MindMapCard] = [
      .chapter(chapterId: "c1"), .lesson(chapterId: "c2", lessonId: "l1"),
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
      .lesson(chapterId: "c2", lessonId: "l1"))
    XCTAssertEqual(
      MindMapDeck.start(in: cards, at: MindMapPosition(chapterId: "gone")),
      .chapter(chapterId: "c1"))
    XCTAssertEqual(MindMapDeck.start(in: cards, at: nil), .chapter(chapterId: "c1"))
  }

  func testALessonInTwoChaptersOpensInTheChapterItWasReadIn() {
    let maps = Self.maps(groups: [
      LessonMapGroup(chapterId: "c1", count: 1, locked: 0, lessonIds: ["l1"]),
      LessonMapGroup(chapterId: "c2", count: 1, locked: 0, lessonIds: ["l1"]),
    ])
    let cards = MindMapDeck.cards(tab: .lessons, maps: maps)
    let second = MindMapCard.lesson(chapterId: "c2", lessonId: "l1")

    XCTAssertEqual(Set(cards).count, 2)
    XCTAssertEqual(MindMapDeck.start(in: cards, at: MindMapPosition(second)), second)
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
}
