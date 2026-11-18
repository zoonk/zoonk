import XCTest

@testable import Zoonk

final class SubjectChapterProgressTests: XCTestCase {
  func testChaptersTestedOutOfCountAlongWithChaptersStudied() {
    let studied = chapter(.done)
    let skipped = chapter(.done, known: true)
    let chapters =
      [studied, skipped, studied, skipped, chapter(.current)]
      + Array(repeating: chapter(.upcoming), count: 5)

    XCTAssertEqual(chapters.doneChapters, [studied, skipped, studied, skipped])
  }

  private func chapter(_ state: PlanChapter.State, known: Bool = false) -> SyllabusSubject.Chapter {
    .init(
      chapterId: nil, far: false, known: known, lessonsDone: 0, lessonsTotal: 1,
      nextDate: nil, position: 1, skillId: nil, state: state, title: "Chapter", writing: false)
  }
}
