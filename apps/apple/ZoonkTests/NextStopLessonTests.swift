import XCTest

@testable import Zoonk

final class NextStopLessonTests: XCTestCase {
  func testTheFirstFrameShowsTheLessonAsTheDaySawIt() throws {
    let ready = NextStopLesson(block: try learn(.ready), read: nil, writing: nil)
    XCTAssertTrue(ready.canStart)

    let notStarted = NextStopLesson(block: try learn(.notStarted), read: nil, writing: nil)
    XCTAssertTrue(notStarted.canStart, "its tap asks for writing")

    let writing = NextStopLesson(block: try learn(.generating), read: nil, writing: nil)
    XCTAssertTrue(writing.isWriting)
    XCTAssertFalse(writing.canStart)

    let failed = NextStopLesson(block: try learn(.failed), read: nil, writing: nil)
    XCTAssertTrue(failed.isFailed)
    XCTAssertFalse(failed.canStart)

    let setAside = NextStopLesson(
      block: try learn(.failed, setAside: true), read: nil, writing: nil)
    XCTAssertTrue(setAside.isSetAside)
    XCTAssertFalse(setAside.isFailed, "a set-aside lesson has no Try again")
    XCTAssertFalse(setAside.canStart)
  }

  func testADayThatDoesntSayHowItsLessonStandsOffersNothingUntilReadinessAnswers() throws {
    let unread = NextStopLesson(block: try learn(nil), read: nil, writing: nil)
    XCTAssertNil(unread.status)
    XCTAssertFalse(unread.canStart)

    let answered = NextStopLesson(
      block: try learn(nil), read: LessonRead(lessonID: "l1", status: .ready, setAside: false),
      writing: nil)
    XCTAssertTrue(answered.canStart)

    let noLesson = NextStopLesson(block: try learn(nil, lessonID: nil), read: nil, writing: nil)
    XCTAssertTrue(noLesson.canStart, "a block with no lesson to read opens as the server says")
  }

  func testReadinessIsNewerThanTheDaysSnapshot() throws {
    let failed = NextStopLesson(
      block: try learn(.generating),
      read: LessonRead(lessonID: "l1", status: .failed, setAside: false), writing: nil)
    XCTAssertTrue(failed.isFailed)

    let other = NextStopLesson(
      block: try learn(.generating),
      read: LessonRead(lessonID: "l2", status: .failed, setAside: false), writing: nil)
    XCTAssertTrue(other.isWriting, "another lesson's answer says nothing about this one")
  }

  func testATapIsNewerThanASnapshotThatSaysTheLessonIsntWritten() throws {
    let asked = NextStopLesson(
      block: try learn(.failed), read: nil, writing: .writing(run: "run-1"))
    XCTAssertTrue(asked.isWriting)

    let stopped = NextStopLesson(
      block: try learn(.failed), read: LessonRead(lessonID: "l1", status: .failed, setAside: false),
      writing: .writing(run: "run-1"))
    XCTAssertTrue(stopped.isFailed, "a read after the tap decides")

    let refused = NextStopLesson(block: try learn(.notStarted), read: nil, writing: .failed)
    XCTAssertTrue(refused.isFailed)

    let takenOver = NextStopLesson(
      block: try learn(.notStarted),
      read: LessonRead(lessonID: "l1", status: .generating, setAside: false), writing: .failed)
    XCTAssertTrue(takenOver.isWriting, "a run writes it after all")
  }

  private func learn(_ status: LessonStatus?, setAside: Bool = false, lessonID: String? = "l1")
    throws -> StudyBlock
  {
    let lesson = status.map { #"{"setAside":\#(setAside),"status":"\#($0.rawValue)"}"# }
    let json = """
      {"answered":0,"areaId":null,"brainPower":0,"canDo":null,"areas":[],"topics":[],
      "canTestOut":false,"capsules":[],"chapterId":null,"checkpoint":null,"estimatedMinutes":5,
      "extra":false,"fullReview":false,"id":"b1","kind":"learn","lesson":\(lesson ?? "null"),
      "lessonId":\(lessonID.map { "\"\($0)\"" } ?? "null"),"mistakesOnly":false,
      "opensInPlayer":false,"oftenTested":false,"planItemId":null,"planItemKey":null,"position":0,
      "preparing":false,"questions":3,"refresh":false,"reinforcement":false,"screen":"lesson",
      "status":"pending","subject":null,"title":"Lesson","waitReason":null,"weakest":false}
      """
    return try JSONDecoder().decode(StudyBlock.self, from: Data(json.utf8))
  }
}
