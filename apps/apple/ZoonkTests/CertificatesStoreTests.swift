import XCTest

@testable import Zoonk

@MainActor
final class CertificatesStoreTests: XCTestCase {
  /// See Plus leaves a moment without closing it, so the next task's result plays it again.
  func testAMomentPlaysUntilContinueClosesIt() async {
    let api = CertificatesAPIStub()
    let store = CertificatesStore(
      api: api, cache: AppCache(session: .preview(account: .certificatesTestAccount)))
    let course = facts("COURSE000001", locked: true)
    let level = facts("LEVEL0000001")
    await store.list.load()

    XCTAssertEqual(store.claimMoments([course]), [course])
    XCTAssertEqual(
      store.claimMoments([course]), [course],
      "Expected a moment left through See Plus to play again after the next task")

    store.closeMoments([course.code])

    XCTAssertEqual(
      store.claimMoments([course, level]), [level],
      "Expected a closed moment that the next result carries again to play no more")
    await store.list.load()

    let reads = await api.listReads
    XCTAssertEqual(reads, 2, "Expected the list to be read again for the certificates just earned")
  }

  func testALockedCertificateHasNoPictureOrLink() throws {
    let certificates = try JSONDecoder().decode(
      [OwnedCertificate].self,
      from: Data(
        "[\(certificateJSON(code: "LOCKED000001", locked: true)), \(certificateJSON(code: "ISSUED000001"))]"
          .utf8))

    XCTAssertEqual(certificates.map(\.facts.code), ["LOCKED000001", "ISSUED000001"])
    XCTAssertNil(certificates[0].issued)
    XCTAssertEqual(
      certificates[1].issued?.url, URL(string: "https://zoonk.com/c/ISSUED000001"))
  }

  func testTheDayEarnedNeverShiftsWithTheDevicesTimeZone() throws {
    let previous = NSTimeZone.default
    NSTimeZone.default = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
    defer { NSTimeZone.default = previous }

    let certificate = facts("K7QF2M9XHD4P", completedOn: "2026-11-01")
    let earned = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-11-01T00:00:00Z"))
    let utc = Date.FormatStyle(timeZone: .gmt)

    XCTAssertEqual(certificate.issueMonth, earned.formatted(utc.year().month(.wide)))
    let day = earned.formatted(utc.year().month(.abbreviated).day())
    XCTAssertTrue(
      certificate.summary.hasSuffix(day.replacingOccurrences(of: " ", with: "\u{00A0}")))
    XCTAssertEqual(certificate.groupedCode, "K7QF-2M9X-HD4P")
  }

  func testALongTitleInJapaneseStillMakesAFileName() throws {
    let certificate = try decodedCertificate(
      code: "K7QF2M9XHD4P", recipientName: "佐藤 花子",
      title: String(repeating: "量子物理学をゼロから", count: 12))

    XCTAssertLessThanOrEqual(certificate.fileName.utf8.count + ".png".utf8.count, 255)
    XCTAssertTrue(certificate.fileName.hasPrefix("佐藤 花子 - 量子物理学"))
  }

  private func facts(
    _ code: String, completedOn: String = "2026-11-03", locked: Bool = false
  ) -> CertificateFacts {
    CertificateFacts(
      code: code, kind: .course, recipientName: "Ana Souza", completedOn: completedOn,
      title: "Quantum physics from scratch", courseLevel: nil, targetLanguage: nil, level: nil,
      topics: [], canDo: [], lessonsStudied: 148, lessonsTestedOut: 0, minutes: 2460,
      locked: locked)
  }
}

private func decodedCertificate(
  code: String, recipientName: String?, title: String = "Quantum physics from scratch"
) throws -> Certificate {
  try JSONDecoder().decode(
    Certificate.self,
    from: Data(certificateJSON(code: code, recipientName: recipientName, title: title).utf8))
}

/// One entry of the learner's list.
private func certificateJSON(
  code: String, recipientName: String? = "Ana Souza",
  title: String = "Quantum physics from scratch", locked: Bool = false
) -> String {
  let recipient = String(
    decoding: (try? JSONEncoder().encode(recipientName)) ?? Data(), as: UTF8.self)
  let links =
    locked
    ? #""url": null, "imageUrls": null, "linkedInUrl": null"#
    : #"""
    "url": "https://zoonk.com/c/\#(code)",
    "imageUrls": {"screen": "https://zoonk.com/a.png", "print": "https://zoonk.com/b.png",
      "link": "https://zoonk.com/c.png", "post": "https://zoonk.com/d.png"},
    "linkedInUrl": "https://www.linkedin.com/profile/add"
    """#

  return #"""
    {"code": "\#(code)", "kind": "course", "recipientName": \#(recipient),
     "completedOn": "2026-11-03", "title": "\#(title)", "courseLevel": "beginner",
     "targetLanguage": null, "level": null, "topics": ["Variables"], "canDo": [],
     "lessonsStudied": 148, "lessonsTestedOut": 0, "minutes": 2460, "locked": \#(locked),
     "shownAt": null, \#(links)}
    """#
}

private actor CertificatesAPIStub: CertificatesAPIClient {
  private(set) var listReads = 0

  func list(token: String) async throws -> [OwnedCertificate] {
    listReads += 1
    return []
  }

  func markShown(token: String, code: String) async throws {}

  func claim(token: String, goalID: String) async throws -> [ClaimedCertificate] {
    []
  }

  func upNext(token: String) async throws -> [CertificateUpNext] {
    []
  }
}

extension CurrentAccount {
  fileprivate static let certificatesTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      email: "learner@zoonk.test", id: "certificates-test-user",
      image: nil, name: "Ana Souza", username: "learner"))
}
