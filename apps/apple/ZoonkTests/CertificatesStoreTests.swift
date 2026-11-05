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

  /// Signing a guest into an account moves the guest's certificates there, under its name.
  func testACertificateIsReadAgainWhenTheSessionChanges() async throws {
    let api = CertificatesAPIStub(recipientNames: [nil, "Ana Souza"])
    let session = SessionStore.preview(account: .certificatesTestAccount)
    let cache = AppCache(session: session)
    let store = CertificatesStore(api: api, cache: cache)
    let certificate = store.certificate(code: "K7QF2M9XHD4P")
    await certificate.load()

    await session.expire(try XCTUnwrap(session.authenticatedSession))
    cache.followSession()

    XCTAssertNotNil(certificate.value, "Kept on screen while it's read again")
    await certificate.load()
    XCTAssertEqual(certificate.value?.facts.recipientName, "Ana Souza")

    cache.followSession()
    await certificate.load()
    let reads = await api.certificateReads
    XCTAssertEqual(reads, 2, "Another window following the same change reads nothing again")
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

  private func facts(_ code: String, completedOn: String = "2026-11-03") -> CertificateFacts {
    CertificateFacts(
      code: code, kind: .course, recipientName: "Ana Souza", completedOn: completedOn,
      title: "Quantum physics from scratch", targetLanguage: nil, level: nil, lessonsStudied: 148,
      minutes: 2460)
  }
}

private func decodedCertificate(
  code: String, recipientName: String?, title: String = "Quantum physics from scratch"
) throws -> Certificate {
  let recipient = String(decoding: try JSONEncoder().encode(recipientName), as: UTF8.self)

  return try JSONDecoder().decode(
    Certificate.self,
    from: Data(
      #"""
      {"code": "\#(code)", "kind": "course", "recipientName": \#(recipient),
       "completedOn": "2026-11-03", "title": "\#(title)", "targetLanguage": null,
       "level": null, "lessonsStudied": 148, "minutes": 2460,
       "url": "https://zoonk.com/c/\#(code)",
       "imageUrls": {"screen": "https://zoonk.com/a.png", "print": "https://zoonk.com/b.png",
         "link": "https://zoonk.com/c.png", "post": "https://zoonk.com/d.png"},
       "linkedInUrl": "https://www.linkedin.com/profile/add"}
      """#.utf8))
}

private actor CertificatesAPIStub: CertificatesAPIClient {
  private(set) var listReads = 0
  private(set) var certificateReads = 0
  /// One per read of the certificate, in order.
  private var recipientNames: [String?]

  init(recipientNames: [String?] = []) {
    self.recipientNames = recipientNames
  }

  func list(token: String) async throws -> [Certificate] {
    listReads += 1
    return []
  }

  func certificate(code: String) async throws -> Certificate {
    certificateReads += 1

    guard !recipientNames.isEmpty else {
      throw APIError.notFound
    }

    return try decodedCertificate(code: code, recipientName: recipientNames.removeFirst())
  }

  func markShown(token: String, code: String) async throws {}

  func claim(token: String, goalID: String) async throws -> ClaimedCertificate? {
    nil
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
