import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import XCTest

@testable import Zoonk

final class WrittenTrendTests: XCTestCase {
  func testOneAnswerHasNoTrend() {
    XCTAssertEqual(writtenTrendBarShares([3]), [])
  }

  func testTwoAnswersAreScaledToTheHigherValue() {
    XCTAssertEqual(writtenTrendBarShares([2, 4]), [0.5, 1])
  }
}

/// Core's `countWritingLines` gives these counts and offsets; the writer, the result and the
/// server must agree on where the board stops reading.
final class WritingLinesTests: XCTestCase {
  /// Core's shared cases (`packages/core/src/exams/essays/_test-utils/writing-lines.json`).
  func testMatchesCoresSharedCases() {
    let cases: [(text: String, perLine: Int, limit: Int?, lines: Int, ignoredFrom: Int?)] = [
      ("e\u{301}🙂\r\n\r\nnext", 2, 2, 4, 8),
      ("aaaaaaaaaa\n", 10, 1, 1, nil),
      ("aaaaaaaaaa\r\n", 10, 1, 1, nil),
      ("aaaaaaaaaa\r", 10, 1, 1, nil),
      ("aaaaaaaaaa\u{2028}", 10, 1, 1, nil),
      ("aaaaaaaaaa\u{2029}", 10, 1, 1, nil),
      ("aaaaaaaaaa\r\n\r\n", 10, 1, 2, 12),
      ("", 10, 1, 0, nil),
    ]

    for item in cases {
      let count = WritingLines.count(item.text, charactersPerLine: item.perLine, limit: item.limit)
      XCTAssertEqual(count.estimatedLines, item.lines, "lines of \(item.text.debugDescription)")
      XCTAssertEqual(count.ignoredFrom, item.ignoredFrom, "limit of \(item.text.debugDescription)")
    }
  }

  func testCountsLinesAsCoreDoes() {
    let cases: [(text: String, perLine: Int, limit: Int?, lines: Int, ignoredFrom: Int?)] = [
      ("", 5, 3, 0, nil),
      ("abc", 5, 3, 1, nil),
      ("abcde", 5, 3, 1, nil),
      ("abcdef", 5, 3, 2, nil),
      ("ab\ncd", 5, 3, 2, nil),
      ("ab\r\ncd", 5, 1, 2, 4),
      ("abcde\nf", 5, 3, 2, nil),
      ("a\n\n\nb", 5, 2, 4, 3),
      ("👍🏽👨‍👩‍👧e\u{301}x", 2, 1, 2, 12),
      ("line\u{2028}two\u{2029}three", 10, nil, 3, nil),
      ("\n", 5, nil, 1, nil),
      ("abcdefghijkl", 3, 2, 4, 6),
    ]

    for item in cases {
      let count = WritingLines.count(item.text, charactersPerLine: item.perLine, limit: item.limit)
      XCTAssertEqual(count.estimatedLines, item.lines, "lines of \(item.text.debugDescription)")
      XCTAssertEqual(count.ignoredFrom, item.ignoredFrom, "limit of \(item.text.debugDescription)")
    }
  }

  func testTheFirstCharacterPastTheLimitIsWhereTheBoardStopsReading() {
    let text = String(repeating: "a", count: 55 * 30) + "b"

    let count = WritingLines.count(text, charactersPerLine: 55, limit: 30)

    XCTAssertEqual(count, .init(estimatedLines: 31, ignoredFrom: 1650))
  }

  func testTheWordALimitSplitsIsMarkedPastItWhole() throws {
    let grade = try decode(WritingResult.self, Self.levels(ignoredFrom: 6, errors: "[]"))

    let pieces = WritingMarks.pieces(grade: grade, text: "abc defghij")

    XCTAssertEqual(pieces.map(\.ignored), [false, true])
    XCTAssertEqual(pieces.last?.start, 4)
  }

  func testAnErrorAfterAnEmojiIsMarkedAtItsUTF16Offset() throws {
    let grade = try decode(
      WritingResult.self,
      Self.levels(
        ignoredFrom: nil,
        errors: #"[{"correction":"two","kind":"spelling","quote":"tow","start":3}]"#))

    let pieces = WritingMarks.pieces(grade: grade, text: "👍 tow cats")

    XCTAssertEqual(pieces.first { $0.error == 0 }.map { ($0.start, $0.end) }?.0, 3)
    XCTAssertEqual(pieces.first { $0.error == 0 }.map { ($0.start, $0.end) }?.1, 6)
  }

  /// Core places marks by JavaScript's UTF-16 offsets, which can fall inside a character.
  func testAMarkInsideACharacterTakesInTheWholeCharacter() throws {
    let cases: [(text: String, errors: String, marked: [String])] = [
      // "cafe" ends between the "e" and its accent.
      (
        "cafe\u{301} teh",
        #"[{"correction":"café","kind":"accent","quote":"cafe","start":0},{"correction":"the","kind":"spelling","quote":"teh","start":6}]"#,
        ["cafe\u{301}", "teh"]
      ),
      // A mark starting on the second half of a thumbs-up and ending inside its skin tone.
      (
        "👍🏽 ok",
        #"[{"correction":"x","kind":"style","quote":"x","start":1}]"#,
        ["👍🏽"]
      ),
      // A mark ending between a family's members.
      (
        "👨‍👩‍👧 go",
        #"[{"correction":"x","kind":"style","quote":"xxx","start":0}]"#,
        ["👨‍👩‍👧"]
      ),
    ]

    for item in cases {
      let grade = try decode(WritingResult.self, Self.levels(ignoredFrom: nil, errors: item.errors))
      let pieces = WritingMarks.pieces(grade: grade, text: item.text)
      let utf16 = Array(item.text.utf16)
      let marked = pieces.filter { $0.error != nil }.map {
        String(decoding: utf16[$0.start..<$0.end], as: UTF16.self)
      }

      XCTAssertEqual(marked, item.marked, item.text.debugDescription)
      XCTAssertEqual(
        pieces.map { String(decoding: utf16[$0.start..<$0.end], as: UTF16.self) }.joined(),
        item.text, "the whole text is still shown")
    }
  }

  func testAMarkThatDoesntFitTheTextIsLeftOutAndTheTextStaysReadable() throws {
    let grade = try decode(
      WritingResult.self,
      Self.levels(
        ignoredFrom: 99,
        errors:
          #"[{"correction":"x","kind":"style","quote":"far beyond","start":40},{"correction":"x","kind":"style","quote":"a","start":-3}]"#
      ))

    let pieces = WritingMarks.pieces(grade: grade, text: "e\u{301}🙂 short")

    XCTAssertEqual(pieces.map(\.error), [nil])
    XCTAssertEqual(pieces.map(\.ignored), [false])
    XCTAssertFalse(
      WritingMarks.attributed(
        grade: grade, lines: 30, text: "e\u{301}🙂 short", noteFont: .body, numberFont: .body
      ).characters.isEmpty)
  }

  func testALimitOnTheSpaceAfterAWordLeavesThatWordRead() {
    XCTAssertEqual(WritingMarks.wordStart("abc def", 3), 3)
    XCTAssertEqual(WritingMarks.wordStart("alpha beta", 5), 5)
    XCTAssertEqual(WritingMarks.wordStart("abc defghij", 6), 4)
    XCTAssertEqual(WritingMarks.wordStart("abc\ndef", 4), 4)

    let cut = WritingLines.count("abc def", charactersPerLine: 3, limit: 1).ignoredFrom
    XCTAssertEqual(cut.map { WritingMarks.wordStart("abc def", $0) }, 3)
  }

  static func levels(ignoredFrom: Int?, errors: String) -> String {
    """
    {"kind":"levels","criteria":[{"comment":"Clear.","id":"c1","level":"strong","name":"Content",\
    "quote":null}],"errors":\(errors),"ignoredFrom":\(ignoredFrom.map(String.init) ?? "null"),\
    "nextStep":null,"progress":null}
    """
  }
}

/// Every result is one shape: levels carry no numbers; points carry ranges.
final class WritingResultDecodingTests: XCTestCase {
  func testWrittenSubjectCanHaveADifferentNameFromItsScoringPart() throws {
    let practice = try decode(
      GoalPlan.WrittenPractice.self,
      """
      {
        "cadence":"weekly","parts":["Written test"],"subjects":[{
          "answers":[],"trend":[],"points":{"name":"Written test","max":100,"tasks":[]}
        }]
      }
      """)
    let subject = try decode(
      SyllabusSubject.self,
      """
      {
        "areas":["Writing"],"chapters":[],"group":"Written test (P2)","key":"writing","lessonsDone":0,
        "lessonsKnown":0,"lessonsTotal":1,"name":"Writing","sharedWith":[],"shortName":"Writing",
        "source":"notice","topics":[],"writtenPart":"Written test"
      }
      """)

    XCTAssertEqual(practice.subject(for: subject)?.points.name, "Written test")
  }

  func testALevelsResultHasNoTotal() throws {
    let grade = try decode(
      WritingResult.self, WritingLinesTests.levels(ignoredFrom: nil, errors: "[]"))

    XCTAssertNil(grade.points)
    XCTAssertEqual(grade.criteria.first?.level, .strong)
  }

  func testAPointsResultKeepsItsRangesAndRows() throws {
    let grade = try decode(WritingResult.self, Self.points(zeroReason: "null"))

    XCTAssertEqual(grade.points?.total, WritingRange(high: 19.4, low: 16.2))
    XCTAssertEqual(grade.points?.deduction, WritingRange(high: 0.35, low: 0.35))
    XCTAssertEqual(grade.points?.rows.first?.max, 9.5)
    XCTAssertNil(grade.points?.zeroReason)
    XCTAssertEqual(
      WritingNextStep(grade: grade, text: "The Court matters."),
      .criterion(
        title: "Powers of the Court", text: "Name at least two powers.",
        quote: "The Court matters.", example: nil))
  }

  func testAZeroedResultSaysTheNoticesRule() throws {
    let grade = try decode(
      WritingResult.self, Self.points(zeroReason: #""An answer off the topic gets zero.""#))

    XCTAssertEqual(grade.points?.zeroReason, "An answer off the topic gets zero.")
  }

  func testAZeroedAnswerIsNeverToldItsDone() throws {
    let grade = try decode(
      WritingResult.self,
      Self.points(zeroReason: #""Off topic.""#)
        .replacingOccurrences(of: #""zeroReason""#, with: #""zeroKind":"offTopic","zeroReason""#))

    XCTAssertEqual(
      WritingNextStep(grade: grade, text: ""),
      .zero(text: "Name at least two powers.", zeroKind: .offTopic))
  }

  func testNothingLeftOnlyWhenEveryCriterionIsCompleteAndEveryLineIsRead() throws {
    let complete = WritingLinesTests.levels(ignoredFrom: nil, errors: "[]")
      .replacingOccurrences(of: #""strong""#, with: #""complete""#)

    XCTAssertEqual(
      WritingNextStep(grade: try decode(WritingResult.self, complete), text: ""), .done)
    XCTAssertEqual(
      WritingNextStep(
        grade: try decode(
          WritingResult.self,
          complete.replacingOccurrences(of: #""ignoredFrom":null"#, with: #""ignoredFrom":4"#)),
        text: "abc def"),
      .limit)
    XCTAssertEqual(
      WritingNextStep(
        grade: try decode(
          WritingResult.self, WritingLinesTests.levels(ignoredFrom: nil, errors: "[]")),
        text: ""),
      .criterion(title: "Content", text: "Clear.", quote: nil, example: nil))
  }

  func testTheGradersTitleLeadsAndAQuoteMissingFromTheTextIsDropped() throws {
    let grade = try decode(
      WritingResult.self,
      Self.points(zeroReason: "null")
        .replacingOccurrences(
          of: #""text":"Name at least two powers."}"#,
          with: #""text":"Name at least two powers.","kind":"criterion","title":"Name two powers"}"#
        ))

    XCTAssertEqual(
      WritingNextStep(grade: grade, text: "Another text."),
      .criterion(
        title: "Name two powers", text: "Name at least two powers.", quote: nil, example: nil))
  }

  func testWholeTestPointsKeepUpToTwoDecimals() {
    XCTAssertEqual(WritingLabels.partPoints(6.25), "6.25")
    XCTAssertEqual(WritingLabels.partPoints(10.75), "10.75")
    XCTAssertEqual(WritingLabels.partPoints(10), "10")
    XCTAssertEqual(WritingLabels.partPoints(6.125), "6.13")
  }

  func testAHeadlineRangeRoundsOutwardSoItNeverClaimsMoreThanItsParts() {
    XCTAssertEqual(
      WritingLabels.roundedOutward(.init(high: 17.41, low: 12.06), decimals: 1),
      .init(high: 17.5, low: 12.0))
    XCTAssertEqual(
      WritingLabels.roundedOutward(.init(high: 0.3, low: 0.3), decimals: 1),
      .init(high: 0.3, low: 0.3))
    XCTAssertEqual(
      WritingLabels.range(.init(high: 26.2, low: 22.8), decimals: 0, headline: true), "22–27")
    XCTAssertEqual(
      WritingLabels.range(.init(high: 27, low: 24), decimals: 1, headline: true), "24.0–27.0")
  }

  func testEveryOtherRangeRoundsEachEndToTheNearestAtItsScalesDecimals() {
    XCTAssertEqual(WritingLabels.range(.init(high: 26.2, low: 22.8), decimals: 0), "23–26")
    XCTAssertEqual(WritingLabels.range(.init(high: 1.34, low: 1.26), decimals: 1), "1.3")
    XCTAssertEqual(
      WritingLabels.range(.init(high: 1.25, low: 1.25), of: 1.25, decimals: 2), "1.25 of 1.25")
    XCTAssertEqual(
      WritingLabels.range(.init(high: 18.6, low: 18.1)), "18–19",
      "A scale the server sends no decimals for is whole points")
  }

  func testAZeroReadsZeroAndADeductionNeverReadsMinusZero() {
    XCTAssertEqual(WritingLabels.range(.init(high: 0, low: 0), of: 9.5, decimals: 1), "0 of 9.5")
    XCTAssertEqual(WritingLabels.range(.init(high: 0.04, low: 0), decimals: 1), "0")
    XCTAssertEqual(WritingLabels.deduction(.init(high: 0.6, low: 0.3)), "−0.3 to −0.6")
    XCTAssertEqual(WritingLabels.deduction(.init(high: 0.6, low: 0.6)), "−0.6")
    XCTAssertEqual(WritingLabels.deduction(.init(high: 0.6, low: 0)), "0 to −0.6")
    XCTAssertEqual(WritingLabels.deduction(.init(high: 0.04, low: 0)), "0")
    XCTAssertEqual(WritingLabels.deduction(.init(high: 2, low: 1)), "−1.0 to −2.0")
  }

  func testAMinimumInPercentIsSaidInThePartsPoints() throws {
    let part = try decode(
      WrittenPartPoints.self,
      #"{"max":40,"minimum":{"unit":"percent","value":50},"name":"Written test","range":{"low":10,"high":15},"standing":"below","tasks":[]}"#
    )

    XCTAssertEqual(part.minimumPoints, 20)
    XCTAssertEqual(
      WritingLabels.range(.init(high: 20 - 10, low: 20 - 15), decimals: 0), "5–10",
      "5–10 points short of the 20 needed, never 35–40 of 50")
  }

  func testAWholeAnswerIsNamedByItsLineLimitOnlyWhenNoOtherTaskSharesIt() {
    func title(_ task: WritingTaskName?) -> String? {
      WritingLabels.taskTitle(unit: .answer, task: task, fallback: "The notice's long sentence")
    }

    XCTAssertEqual(
      title(.init(distinctLines: true, lines: 30, number: 1, points: 30, total: 2)),
      "Write the 30-line question")
    XCTAssertEqual(
      title(.init(distinctLines: false, lines: 30, number: 2, points: 30, total: 2)),
      "Write question 2")
    XCTAssertEqual(
      title(.init(distinctLines: false, lines: nil, number: 1, points: nil, total: 1)),
      "Write the question")
    XCTAssertEqual(title(nil), "The notice's long sentence")
    XCTAssertEqual(
      WritingLabels.taskTitle(unit: .drill, task: nil, fallback: nil), "Short writing exercise")
  }

  func testATaskWaitingForAnExamChoiceSaysWhichAndTheOthersStayOpen() throws {
    let practice = try decode(
      GoalPlan.WrittenPractice.self,
      """
      {
        "cadence":"weekly","parts":["Written test"],"subjects":[{
          "answers":[],"trend":[],"points":{"name":"Written test","max":100,"tasks":[
            {"key":"short","max":30,"name":"Short question","range":null},
            {"key":"long","max":70,"name":"Long question","range":null}
          ]},
          "writeActions":[
            {"availability":{"status":"available"},"taskKey":"short"},
            {"availability":{"status":"needsChoice","choiceGroups":["Specialty"]},"taskKey":"long"}
          ]
        }]
      }
      """)

    let choice = try XCTUnwrap(practice.subjects?.first?.pendingChoice)
    XCTAssertEqual(choice.groups, ["Specialty"])
    XCTAssertFalse(choice.all)
    XCTAssertEqual(choice.task, "Long question")
    XCTAssertEqual(practice.subjects?.first?.shownScale, .levels)
  }

  func testAnUnknownKindIsAFailedReadNotAMadeUpGrade() {
    XCTAssertThrowsError(
      try decode(
        WritingResult.self,
        WritingLinesTests.levels(ignoredFrom: nil, errors: "[]")
          .replacingOccurrences(of: #""levels""#, with: #""stars""#)))
  }

  func testAStartReadsEachOfItsAnswers() throws {
    XCTAssertEqual(
      try WritingStartWire.recode(Wire(status: "ready", admissionId: "a1")),
      .ready(admissionId: "a1"))
    XCTAssertEqual(
      try WritingStartWire.recode(Wire(status: "writing", runId: "wrun_1", unit: "drill")),
      .writing(generationId: "wrun_1", unit: .drill))
    XCTAssertEqual(
      try WritingStartWire.recode(Wire(status: "limitReached", returnsOn: "2026-11-21")),
      .limitReached(returnsOn: "2026-11-21", task: nil))
  }

  static func points(zeroReason: String) -> String {
    """
    {"kind":"points","criteria":[{"comment":"Names two powers.","id":"a2","level":"partial",\
    "name":"Powers of the Court","quote":"The Court matters."}],"errors":[],"ignoredFrom":null,\
    "nextStep":{"criterionId":"a2","example":null,"quote":"The Court matters.",\
    "text":"Name at least two powers."},"progress":{"fixed":[],"persists":["a2"]},\
    "content":{"high":19.75,"low":16.55},"deduction":{"high":0.35,"low":0.35},"max":30,\
    "rows":[{"earned":4.75,"id":"a2","max":9.5}],"total":{"high":19.4,"low":16.2},\
    "zeroReason":\(zeroReason)}
    """
  }

  private struct Wire: Encodable {
    var status: String
    var admissionId: String?
    var runId: String?
    var returnsOn: String?
    var unit: String?
  }
}

/// What a learner writes is never lost: a draft saved elsewhere, a late save's answer, a lost
/// grade, the network going away or a paste too long for the server each keep what was typed.
@MainActor
final class WritingDraftTests: XCTestCase {
  private let blockId = "01a1fac7-1f8c-7827-b3b7-6f5f50afc190"
  private static let admission = "00000000-0000-4000-8000-0000000000a1"

  override func tearDown() {
    KeptWriting.clear(blockId)
    super.tearDown()
  }

  func testAnEditBelongsToItsAdmissionAndWinsOnlyOverTheRevisionItWasTypedOn() {
    let saved = WritingDraft(admissionId: "a1", revision: 2, text: "Saved elsewhere.")
    let recover = { (kept: KeptWriting.Kept?) in
      KeptWriting.recover(kept, saved: saved, admissionId: "a1", graded: nil)
    }

    XCTAssertEqual(
      recover(.init(admissionId: "a1", base: 2, text: "Typed here.")), .kept("Typed here."))
    XCTAssertEqual(
      recover(.init(admissionId: "a1", base: 1, text: "Typed here.")), .conflict("Typed here."),
      "A newer draft saved elsewhere is the learner's call, never dropped")
    XCTAssertEqual(recover(.init(admissionId: "a1", base: 1, text: "Saved elsewhere.")), .saved)
    XCTAssertEqual(recover(nil), .saved)
    XCTAssertEqual(
      recover(.init(admissionId: "old", base: 9, text: "First answer.")), .saved,
      "A first draft is never offered for a rewrite started since, whatever its revision")
  }

  func testAClearedAnswerStaysCleared() {
    XCTAssertEqual(
      KeptWriting.recover(
        .init(admissionId: "a1", base: 3, text: ""),
        saved: .init(admissionId: "a1", revision: 3, text: "old"), admissionId: "a1", graded: nil),
      .kept(""))
  }

  func testAnEditTypedWhileItsOwnSaveLandedBuildsOnThatSave() {
    let kept = KeptWriting.Kept(
      admissionId: "a1", base: 0, text: "second", sending: "first")

    XCTAssertEqual(
      KeptWriting.recover(
        kept, saved: .init(admissionId: "a1", revision: 1, text: "first"), admissionId: "a1",
        graded: nil),
      .kept("second"))
  }

  func testEditsAfterAGradedAnswerWaitForTheRewrite() {
    let kept = KeptWriting.Kept(admissionId: "a1", base: 2, text: "Edited after.")

    XCTAssertEqual(
      KeptWriting.recover(kept, saved: nil, admissionId: nil, graded: "Graded."),
      .afterGrading("Edited after."))
    XCTAssertEqual(
      KeptWriting.recover(
        .init(admissionId: "a1", base: 2, text: "Graded."), saved: nil, admissionId: nil,
        graded: "Graded."),
      .saved)
  }

  func testAFirstDraftKeptHereNeverGoesOverARewriteStartedElsewhere() async {
    KeptWriting.keep(
      .init(admissionId: Self.admission, base: 9, text: "The first answer."), blockId: blockId)
    let server = WritingServer(draft: .init(revision: 0, text: ""))
    let api = ExamAPI(clients: APIClientFactory(baseURL: Self.baseURL, transport: server))
    let store = ExamStore(api: api, cache: AppCache(session: .preview(account: .writingTest)))
    let view = try! decode(
      EssayView.self,
      Self.essay(blockId: blockId, draft: "null", drafts: "[]")
        .replacingOccurrences(
          of: #"{"blockId""#,
          with: #"{"admissionId":"00000000-0000-4000-8000-0000000000a2","blockId""#))
    let writer = EssayWriter(store: store, view: view, admissionId: nil)

    await writer.flush()

    XCTAssertEqual(writer.text, "")
    let saves = await server.saves
    XCTAssertEqual(saves.count, 0, "Closing saves nothing of the first answer")
  }

  func testADraftSavedElsewhereStopsSavingUntilTheLearnerPicks() async {
    let server = WritingServer(draft: .init(revision: 3, text: "Saved on the phone."))
    let writer = makeWriter(server, draftRevision: 1, draftText: "Started.")

    writer.write("My edit, typed offline.")
    await writer.flush()
    await writer.flush()

    var saves = await server.saves
    XCTAssertEqual(saves.map(\.revision), [1], "Nothing goes over the other draft unasked")
    XCTAssertEqual(writer.conflict?.text, "Saved on the phone.")
    XCTAssertEqual(writer.text, "My edit, typed offline.")
    XCTAssertEqual(KeptWriting.read(blockId)?.text, "My edit, typed offline.")
    XCTAssertFalse(writer.canSend)

    await writer.keepThisOne()

    saves = await server.saves
    XCTAssertEqual(saves.last?.revision, 3, "Kept from the server's current revision")
    let stored = await server.draft
    XCTAssertEqual(stored.text, "My edit, typed offline.")
    XCTAssertNil(writer.conflict)
    XCTAssertNil(KeptWriting.read(blockId), "Saved, so nothing is left to recover")
  }

  func testUsingTheOtherDraftReplacesTheTextHere() async {
    let server = WritingServer(draft: .init(revision: 3, text: "Saved on the phone."))
    let writer = makeWriter(server, draftRevision: 1, draftText: "Started.")

    writer.write("My edit.")
    await writer.flush()
    writer.useTheOther()
    await writer.flush()

    XCTAssertEqual(writer.text, "Saved on the phone.")
    XCTAssertNil(writer.conflict)
    let saves = await server.saves
    XCTAssertEqual(saves.count, 1, "The other draft is already saved")
    XCTAssertNil(KeptWriting.read(blockId))
  }

  func testReopeningAConflictingDraftRequiresChoosingAVersion() async throws {
    KeptWriting.keep(
      .init(admissionId: Self.admission, base: 1, text: "Typed here."), blockId: blockId)
    let server = WritingServer(draft: .init(revision: 3, text: "Saved on the phone."))
    let dependencies = AppDependencies(
      clients: APIClientFactory(baseURL: Self.baseURL, transport: server),
      session: .preview(account: .writingTest), imageLoader: .live(), subscriptionStore: .live())
    let window = try show(
      EssayScreen(blockId: blockId)
        .appDependencies(dependencies)
        .environment(AppRouter())
        .zoonkStyles())

    try await waitForTestCondition("The draft conflict alert did not appear") {
      window.rootViewController?.presentedViewController is UIAlertController
    }
    let alert = try XCTUnwrap(
      window.rootViewController?.presentedViewController as? UIAlertController)
    XCTAssertEqual(Set(alert.actions.compactMap(\.title)), ["Keep this one", "Use the other"])
    XCTAssertEqual(alert.actions.count, 2)
  }

  func testASavesAnswerNeverErasesNewerTyping() async {
    let server = WritingServer(draft: .init(revision: 1, text: "Started."), holdsSaves: true)
    let writer = makeWriter(server, draftRevision: 1, draftText: "Started.")

    writer.write("first")
    let saving = Task { await writer.flush() }
    await server.waitForSaves(1)
    writer.write("first plus a new paragraph")
    await server.releaseSaves()
    await saving.value

    XCTAssertEqual(writer.text, "first plus a new paragraph")
    let kept = KeptWriting.read(blockId)
    XCTAssertEqual(kept?.admissionId, Self.admission)
    XCTAssertEqual(kept?.base, 2)
    XCTAssertEqual(kept?.text, "first plus a new paragraph")

    await writer.flush()
    let stored = await server.draft
    XCTAssertEqual(stored, .init(revision: 3, text: "first plus a new paragraph"))
  }

  func testASavesAnswerKeepsAnotherWindowsDraft() async {
    let server = WritingServer(draft: .init(revision: 1, text: "Started."), holdsSaves: true)
    let first = makeWriter(server, draftRevision: 1, draftText: "Started.")
    let second = makeWriter(server, draftRevision: 1, draftText: "Started.")

    first.write("First window")
    let saving = Task { await first.flush() }
    await server.waitForSaves(1)
    second.write("Unsaved in the second window")
    await server.releaseSaves()
    await saving.value

    XCTAssertEqual(KeptWriting.read(blockId)?.text, "Unsaved in the second window")
  }

  func testItsOwnSaveThatLandedWithItsAnswerLostIsBuiltOn() async {
    let server = WritingServer(draft: .init(revision: 1, text: "Started."), losesFirstAnswer: true)
    let writer = makeWriter(server, draftRevision: 1, draftText: "Started.")

    writer.write("first")
    await writer.flush()
    writer.write("first and second")
    await writer.flush()

    XCTAssertNil(writer.conflict)
    let stored = await server.draft
    XCTAssertEqual(stored, .init(revision: 3, text: "first and second"))
  }

  func testTextTypedOfflineIsSavedWhenTheConnectionReturnsWithoutAnotherKeystroke() async throws {
    let server = WritingServer(draft: .init(revision: 1, text: "Started."), failsSaves: 1)
    let writer = makeWriter(server, draftRevision: 1, draftText: "Started.")

    writer.write("Typed on the train.")
    await writer.flush()
    XCTAssertTrue(writer.saveFailed)

    var waited = 0
    while await server.draft.text != "Typed on the train.", waited < 100 {
      try await Task.sleep(for: .milliseconds(50))
      waited += 1
    }

    let stored = await server.draft
    XCTAssertEqual(stored.text, "Typed on the train.")
    XCTAssertFalse(writer.saveFailed)
  }

  func testNothingTypedWhileGradingIsLost() async {
    let server = WritingServer(draft: .init(revision: 1, text: "Started."), holdsGrading: true)
    let writer = makeWriter(server, draftRevision: 1, draftText: "Started.")

    writer.write("first")
    let sending = Task { await writer.send() }
    await server.waitForGrading()
    writer.write("first plus correction")
    XCTAssertEqual(writer.text, "first", "The field is read-only while its text is graded")
    await server.releaseGrading()
    await sending.value

    XCTAssertEqual(writer.latest?.text, "first")
    XCTAssertEqual(writer.mode, .result)
  }

  func testARetryAfterALostGradeKeepsTheEditsMadeSince() async {
    let server = WritingServer(draft: .init(revision: 1, text: "Started."), losesFirstGrade: true)
    let writer = makeWriter(server, draftRevision: 1, draftText: "Started.")

    writer.write("A")
    await writer.send()
    XCTAssertEqual(writer.status, .failed)

    writer.write("A, improved")
    await writer.send()

    XCTAssertEqual(writer.latest?.text, "A", "The grade is the first text's")
    XCTAssertEqual(writer.editsAfterGrading, "A, improved")
    XCTAssertEqual(KeptWriting.read(blockId)?.text, "A, improved")

    await writer.rewrite()
    XCTAssertEqual(writer.text, "A, improved", "The rewrite starts from the edits")
    XCTAssertNil(writer.editsAfterGrading)
  }

  func testAReplayedGradeAfterReopeningKeepsTheEditsForARewrite() async {
    let server = WritingServer(draft: .init(revision: 1, text: "Started."), losesFirstGrade: true)
    let first = makeWriter(server, draftRevision: 1, draftText: "Started.")

    first.write("A")
    await first.send()
    XCTAssertEqual(first.status, .failed)
    first.write("A, improved")
    await first.flush()
    XCTAssertEqual(KeptWriting.read(blockId)?.text, "A, improved")

    // The reopened screen starts from the cached draft and the edits kept on this device.
    let reopened = makeWriter(server, draftRevision: 2, draftText: "A")
    XCTAssertEqual(reopened.text, "A, improved")
    await server.failReadAfterNextGrade()
    await reopened.send()
    XCTAssertEqual(KeptWriting.read(blockId)?.text, "A, improved")
    XCTAssertEqual(reopened.status, .failed)
    XCTAssertNil(reopened.latest)

    await reopened.send()

    let submitted = await server.submitted
    XCTAssertEqual(submitted.map(\.admissionId), [Self.admission, Self.admission, Self.admission])
    XCTAssertEqual(submitted.map(\.text), ["A", "A, improved", "A, improved"])
    XCTAssertEqual(reopened.mode, .result)
    XCTAssertEqual(reopened.latest?.text, "A")
    XCTAssertEqual(reopened.editsAfterGrading, "A, improved")
    XCTAssertEqual(KeptWriting.read(blockId)?.text, "A, improved")

    await reopened.rewrite()
    XCTAssertEqual(reopened.text, "A, improved")
  }

  func testAnAnswerChangedSinceTheGradedVersionOutlivesTheAppBeingKilled() async {
    let server = WritingServer(draft: .init(revision: 1, text: "Started."), losesFirstGrade: true)
    let first = makeWriter(server, draftRevision: 1, draftText: "Started.")

    first.write("A")
    await first.send()
    first.write("A, improved")
    await first.send()
    XCTAssertEqual(first.editsAfterGrading, "A, improved")

    // The editor disappears on results and can flush again as the app goes inactive.
    let savesBeforeLeaving = await server.saves.count
    await first.flush()
    let savesAfterLeaving = await server.saves.count
    XCTAssertEqual(savesAfterLeaving, savesBeforeLeaving)
    XCTAssertEqual(KeptWriting.read(blockId)?.afterGrading, true)

    // The app is killed: the next launch reads the block again and has only this device's copy.
    let store = Self.store(server)
    let essay = store.essay(blockId: blockId)
    await essay.refresh()
    let reopened = EssayWriter(store: store, view: essay.value!, admissionId: nil)

    XCTAssertEqual(reopened.mode, .result)
    XCTAssertEqual(reopened.latest?.text, "A")
    XCTAssertEqual(reopened.editsAfterGrading, "A, improved")

    await reopened.rewrite()
    XCTAssertEqual(reopened.text, "A, improved", "Rewrite starts from the changed answer")
  }

  func testOpeningTheBlockAgainStartsFromItsLastSave() async {
    let server = WritingServer(draft: .init(revision: 1, text: "Started."))
    let store = Self.store(server)
    let essay = store.essay(blockId: blockId)
    await essay.refresh()
    let writer = EssayWriter(store: store, view: essay.value!, admissionId: nil)

    writer.write("Saved later.")
    await writer.flush()

    let reopened = EssayWriter(store: store, view: essay.value!, admissionId: nil)
    XCTAssertEqual(reopened.text, "Saved later.")
    XCTAssertEqual(essay.value?.draft?.revision, 2)
  }

  func testTheFieldStopsAtTheLongestAnswerTheServerTakes() {
    let server = WritingServer(draft: .init(revision: 1, text: "Started."))
    let writer = makeWriter(server, draftRevision: 1, draftText: "Started.")

    writer.write(String(repeating: "a", count: 48_001))
    XCTAssertEqual(writer.text.utf16.count, 48_000)

    // A character the limit would split stays out whole.
    writer.write(String(repeating: "a", count: 47_999) + "👍🏽")
    XCTAssertEqual(writer.text, String(repeating: "a", count: 47_999))
  }

  func testAnAnswerSentIsGradedUnderItsAdmissionAndOpensTheResult() async {
    let server = WritingServer(draft: .init(revision: 1, text: "Started."))
    let writer = makeWriter(server, draftRevision: 1, draftText: "Started.")

    writer.write("My answer.")
    await writer.send()

    let submitted = await server.submitted
    XCTAssertEqual(submitted.map(\.admissionId), [Self.admission])
    XCTAssertEqual(writer.mode, .result)
    XCTAssertNil(writer.latest?.grade.points)
    XCTAssertEqual(
      writer.latest?.attemptId, "3674d948-e89d-8489-851c-fd3687fcb325",
      "The saved answer a rewrite starts from is read back")
    XCTAssertNil(KeptWriting.read(blockId), "What was sent leaves this device")
  }

  private func makeWriter(_ server: WritingServer, draftRevision: Int, draftText: String)
    -> EssayWriter
  {
    let view = try! decode(
      EssayView.self,
      Self.essay(
        blockId: blockId,
        draft:
          #"{"admissionId":"\#(Self.admission)","revision":\#(draftRevision),"text":"\#(draftText)"}"#,
        drafts: "[]"))
    return EssayWriter(store: Self.store(server), view: view, admissionId: nil)
  }

  private static func store(_ server: WritingServer) -> ExamStore {
    let api = ExamAPI(clients: APIClientFactory(baseURL: baseURL, transport: server))
    return ExamStore(api: api, cache: AppCache(session: .preview(account: .writingTest)))
  }

  private static let baseURL = URL(string: "https://api.zoonk.test")!

  nonisolated static func essay(blockId: String, draft: String, drafts: String) -> String {
    """
    {"blockId":"\(blockId)","context":null,"drafts":\(drafts),"draft":\(draft),\
    "gradesLeft":6,"pacing":{"minutes":70,"source":"estimated"},"question":"Write it.",\
    "rubric":"points","sessionId":"01a1fac7-1f46-7548-a88d-e54152b01cad","status":"active",\
    "writing":{"charactersPerLine":55,"criteria":[{"id":"c1","name":"Content","points":null}],\
    "keySource":"practiceKey","lines":30,"minimumWords":30,"points":30,"taskKey":"short",\
    "title":"Internal and external control","unit":"answer"}}
    """
  }
}

/// The API's draft and grading rules on one block: a save over a stale revision is refused with
/// the current draft, and an admission graded once replays that grade. Each switch makes one
/// thing go wrong the way a real network does.
private actor WritingServer: ClientTransport {
  struct Draft: Codable, Equatable {
    var revision: Int
    var text: String
  }

  struct Save: Decodable {
    let revision: Int
    let text: String
  }

  struct Submit: Decodable {
    let admissionId: String
    let text: String
  }

  private(set) var draft: Draft
  private(set) var saves: [Save] = []
  private(set) var submitted: [Submit] = []
  private var graded: String?
  private var admission = "00000000-0000-4000-8000-0000000000a1"
  private var holdsSaves: Bool
  private var holdsGrading: Bool
  private var losesFirstAnswer: Bool
  private var losesFirstGrade: Bool
  private var failsReadAfterGrade = false
  private var failsRead = false
  private var failsSaves: Int
  private var released: [CheckedContinuation<Void, Never>] = []

  init(
    draft: Draft, holdsSaves: Bool = false, holdsGrading: Bool = false,
    losesFirstAnswer: Bool = false, losesFirstGrade: Bool = false, failsSaves: Int = 0
  ) {
    self.draft = draft
    self.holdsSaves = holdsSaves
    self.holdsGrading = holdsGrading
    self.losesFirstAnswer = losesFirstAnswer
    self.losesFirstGrade = losesFirstGrade
    self.failsSaves = failsSaves
  }

  func waitForSaves(_ count: Int) async {
    while saves.count < count { await Task.yield() }
  }

  func failReadAfterNextGrade() {
    failsReadAfterGrade = true
  }

  func waitForGrading() async {
    while submitted.isEmpty { await Task.yield() }
  }

  func releaseSaves() {
    holdsSaves = false
    resumeHeld()
  }

  func releaseGrading() {
    holdsGrading = false
    resumeHeld()
  }

  private func resumeHeld() {
    for continuation in released { continuation.resume() }
    released = []
  }

  private func hold() async {
    await withCheckedContinuation { released.append($0) }
  }

  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var data = Data()
    if let body {
      data = try await Data(collecting: body, upTo: 1 << 20)
    }

    switch operationID {
    case "saveWritingDraft":
      let save = try JSONDecoder().decode(Save.self, from: data)
      saves.append(save)

      if holdsSaves { await hold() }

      if graded != nil {
        return (
          HTTPResponse(status: .conflict, headerFields: [.contentType: "application/json"]),
          HTTPBody(
            #"{"error":{"code":"CONFLICT","message":"This answer has already been submitted"}}"#)
        )
      }

      if failsSaves > 0 {
        failsSaves -= 1
        return (HTTPResponse(status: .serviceUnavailable), nil)
      }

      guard save.revision == draft.revision else {
        return try json(.conflict, draft)
      }

      draft = Draft(revision: draft.revision + 1, text: save.text)

      if losesFirstAnswer {
        losesFirstAnswer = false
        return (HTTPResponse(status: .serviceUnavailable), nil)
      }

      return try json(.ok, draft)
    case "submitEssay":
      let submit = try JSONDecoder().decode(Submit.self, from: data)
      submitted.append(submit)

      if holdsGrading { await hold() }

      graded = graded ?? submit.text

      if losesFirstGrade {
        losesFirstGrade = false
        return (HTTPResponse(status: .gatewayTimeout), nil)
      }

      failsRead = failsReadAfterGrade
      failsReadAfterGrade = false

      return (
        HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
        HTTPBody(WritingLinesTests.levels(ignoredFrom: nil, errors: "[]"))
      )
    case "getEssay":
      if failsRead {
        failsRead = false
        return (HTTPResponse(status: .serviceUnavailable), nil)
      }

      let drafts =
        graded.map {
          #"[{"attemptId":"3674d948-e89d-8489-851c-fd3687fcb325","submittedAt":"2026-11-20T12:00:00.000Z","text":\#(String(data: try! JSONEncoder().encode($0), encoding: .utf8)!),"grade":\#(WritingLinesTests.levels(ignoredFrom: nil, errors: "[]"))}]"#
        } ?? "[]"
      let current =
        graded == nil
        ? #"{"admissionId":"00000000-0000-4000-8000-0000000000a1","revision":\#(draft.revision),"text":\#(String(data: try JSONEncoder().encode(draft.text), encoding: .utf8)!)}"#
        : "null"
      return (
        HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
        HTTPBody(
          WritingDraftTests.essay(
            blockId: "01a1fac7-1f8c-7827-b3b7-6f5f50afc190", draft: current, drafts: drafts
          )
          .replacingOccurrences(
            of: #"{"blockId""#, with: #"{"admissionId":"\#(admission)","blockId""#))
      )
    case "startWriting":
      admission = "00000000-0000-4000-8000-0000000000a2"
      graded = nil
      draft = Draft(revision: 0, text: "")
      return (
        HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
        HTTPBody(#"{"status":"ready","admissionId":"00000000-0000-4000-8000-0000000000a2"}"#)
      )
    default:
      return (HTTPResponse(status: .notFound), nil)
    }
  }

  private func json(_ status: HTTPResponse.Status, _ draft: Draft) throws -> (
    HTTPResponse, HTTPBody?
  ) {
    struct Wire: Encodable {
      let admissionId = "00000000-0000-4000-8000-0000000000a1"
      let revision: Int
      let text: String
    }

    return (
      HTTPResponse(status: status, headerFields: [.contentType: "application/json"]),
      HTTPBody(try JSONEncoder().encode(Wire(revision: draft.revision, text: draft.text)))
    )
  }
}

private func decode<Value: Decodable>(_ type: Value.Type, _ json: String) throws -> Value {
  let decoder = JSONDecoder()
  decoder.dateDecodingStrategy = .iso8601
  return try decoder.decode(type, from: Data(json.utf8))
}

extension CurrentAccount {
  fileprivate static let writingTest = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test", id: "writing-test-user",
      image: nil, name: "Learner", username: "learner"))
}
