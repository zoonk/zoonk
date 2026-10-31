import XCTest

@testable import Zoonk

final class BlobUploadTests: XCTestCase {
  func testReadsTheStoreAPresignedUploadIsForFromItsDelegationToken() {
    let payload = Data(#"{"storeId":"store_AbC123","exp":1}"#.utf8).base64EncodedString()
      .replacing("+", with: "-").replacing("/", with: "_").replacing("=", with: "")

    XCTAssertEqual(BlobUpload.storeID(in: "\(payload).signature"), "AbC123")
  }

  func testAMalformedDelegationTokenHasNoStore() {
    XCTAssertNil(BlobUpload.storeID(in: "not-json.signature"))
  }
}
