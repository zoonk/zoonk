import XCTest

@testable import Zoonk

@MainActor
final class CertificatesStoreTests: XCTestCase {
  func testEachMomentPlaysOnceAndTheListGainsItsCertificate() async {
    let api = CertificatesAPIStub()
    let store = CertificatesStore(
      api: api, cache: AppCache(session: .preview(account: .certificatesTestAccount)))
    let course = facts("COURSE000001")
    let level = facts("LEVEL0000001")
    await store.list.load()

    XCTAssertEqual(store.claimMoments([course]), [course])
    XCTAssertEqual(
      store.claimMoments([course, level]), [level],
      "Expected a certificate that the next result carries again to play once")
    XCTAssertEqual(store.claimMoments([course, level]), [])
    await store.list.load()

    let reads = await api.listReads
    XCTAssertEqual(reads, 2)
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
    let title = String(repeating: "量子物理学をゼロから", count: 12)
    let certificate = try JSONDecoder().decode(
      Certificate.self,
      from: Data(
        #"""
        {"code": "K7QF2M9XHD4P", "kind": "course", "recipientName": "佐藤 花子",
         "completedOn": "2026-11-03", "title": "\#(title)", "targetLanguage": null,
         "level": null, "lessonsStudied": 148, "minutes": 2460,
         "url": "https://zoonk.com/c/K7QF2M9XHD4P",
         "imageUrls": {"screen": "https://zoonk.com/a.png", "print": "https://zoonk.com/b.png",
           "link": "https://zoonk.com/c.png", "post": "https://zoonk.com/d.png"},
         "linkedInUrl": "https://www.linkedin.com/profile/add"}
        """#.utf8))

    XCTAssertLessThanOrEqual(certificate.fileName.utf8.count + ".png".utf8.count, 255)
    XCTAssertTrue(certificate.fileName.hasPrefix("佐藤 花子 - 量子物理学"))
  }

  private func facts(_ code: String, completedOn: String = "2026-11-03") -> CertificateFacts {
    CertificateFacts(
      code: code, kind: .course, recipientName: "Ana Souza", completedOn: completedOn,
      title: "Quantum physics from scratch", targetLanguage: nil, level: nil, lessonsStudied: 148,
      minutes: 2460)
  }
}

private actor CertificatesAPIStub: CertificatesAPIClient {
  private(set) var listReads = 0

  func list(token: String) async throws -> [Certificate] {
    listReads += 1
    return []
  }

  func certificate(code: String) async throws -> Certificate {
    throw APIError.notFound
  }

  func markShown(token: String, code: String) async throws {}

  func claim(token: String, goalID: String) async throws -> ClaimedCertificate? {
    nil
  }
}

extension CurrentAccount {
  fileprivate static let certificatesTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
    user: AccountUser(
      displayUsername: "learner", email: "learner@zoonk.test", id: "certificates-test-user",
      image: nil, name: "Ana Souza", username: "learner"))
}
