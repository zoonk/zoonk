import XCTest

@testable import Zoonk

final class CourseOutlineLearnerTests: XCTestCase {
  func testOpensTheLearnersLevelOnceTheirSummaryAnswersAndTheFirstForVisitors() {
    let follows = summary(courseLevel: .intermediate)

    XCTAssertEqual(OutlineLearner(signedIn: false, summary: .idle, courseID: "course"), .noPlan)
    XCTAssertEqual(OutlineLearner(signedIn: true, summary: .idle, courseID: "course"), .waiting)
    XCTAssertEqual(OutlineLearner(signedIn: true, summary: .loading, courseID: "course"), .waiting)
    XCTAssertEqual(
      OutlineLearner(signedIn: true, summary: .loaded(follows), courseID: "course"),
      .follows(chapterID: nil, level: .intermediate))
    XCTAssertEqual(
      OutlineLearner(signedIn: true, summary: .loaded(follows), courseID: "other"), .noPlan)
    XCTAssertEqual(
      OutlineLearner(signedIn: true, summary: .failed(.network), courseID: "course"), .noPlan)
  }

  func testOpensOnlyItsLevelAndNoneWhileWaiting() {
    XCTAssertFalse(OutlineLearner.waiting.opens(.beginner, isFirst: true))
    XCTAssertTrue(OutlineLearner.noPlan.opens(.beginner, isFirst: true))
    XCTAssertFalse(OutlineLearner.noPlan.opens(.intermediate, isFirst: false))
    XCTAssertTrue(
      OutlineLearner.follows(chapterID: nil, level: nil).opens(.beginner, isFirst: true))

    let intermediate = OutlineLearner.follows(chapterID: nil, level: .intermediate)
    XCTAssertFalse(intermediate.opens(.beginner, isFirst: true))
    XCTAssertTrue(intermediate.opens(.intermediate, isFirst: false))
  }

  func testMarksTheNextLessonsChapterOrItsLevelWhileThatLessonIsUnwritten() {
    let inChapter = OutlineLearner(
      signedIn: true, summary: .loaded(summary(courseChapterID: "chapter", courseLevel: .beginner)),
      courseID: "course")

    XCTAssertTrue(inChapter.isHere(chapterID: "chapter"))
    XCTAssertFalse(inChapter.isHere(chapterID: "other"))
    XCTAssertFalse(inChapter.isHere(level: .beginner))

    let unwritten = OutlineLearner.follows(chapterID: nil, level: .advanced)
    XCTAssertTrue(unwritten.isHere(level: .advanced))
    XCTAssertFalse(unwritten.isHere(level: .beginner))
    XCTAssertFalse(OutlineLearner.noPlan.isHere(level: .beginner))
    XCTAssertFalse(OutlineLearner.waiting.isHere(chapterID: "chapter"))
  }

  func testUnfoldsAListOnlyWhenItsFoldHidesTheLearnersChapter() {
    let learner = OutlineLearner.follows(chapterID: "late", level: .beginner)

    XCTAssertTrue(learner.unfolds(["early", "late"]))
    XCTAssertFalse(learner.unfolds(["early"]))
    XCTAssertFalse(OutlineLearner.noPlan.unfolds(["late"]))
  }

  func testShowsTheExamplePlansNumbersOnlyToSomeoneWithoutAPlanOnTheCourse() {
    XCTAssertTrue(OutlineLearner.noPlan.showsExampleNumbers)
    XCTAssertFalse(OutlineLearner.waiting.showsExampleNumbers)
    XCTAssertFalse(OutlineLearner.follows(chapterID: nil, level: nil).showsExampleNumbers)
  }

  private func summary(courseChapterID: String? = nil, courseLevel: CourseLevel?)
    -> LearnerSummary
  {
    LearnerSummary(
      activeGoalID: "goal",
      buddy: BuddyLook(),
      buddyName: nil,
      goals: [
        LearnerGoal(
          courseChapterID: courseChapterID, courseID: "course", courseLevel: courseLevel,
          dailyMinutes: 20, id: "goal", kind: .learn, status: .active, targetDate: nil,
          title: "Statistics")
      ],
      identity: LearnerIdentity(isAnonymous: false, signedInAt: .now, userID: "learner"),
      level: nil,
      nextChangeAt: .distantFuture,
      places: LearnerPlaces(exam: false, mindMaps: false, readyMistakes: 0, speaking: false),
      readAt: .now,
      tier: .free,
      timeZone: nil,
      todayBlocksLeft: nil)
  }
}
