import CryptoKit
import Foundation
import Security

enum AuthenticationNonceError: Error {
  case generationFailed(OSStatus)
}

enum AuthenticationNonce {
  /// Creates an unpredictable, URL-safe nonce so a captured Apple identity token cannot be replayed in another sign-in attempt.
  static func make() throws -> String {
    var bytes = [UInt8](repeating: 0, count: 32)
    let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)

    guard status == errSecSuccess else {
      throw AuthenticationNonceError.generationFailed(status)
    }

    return Data(bytes).base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }

  /// Hashes the raw nonce before it leaves the device while keeping the original value for the API's verification request.
  static func hash(_ nonce: String) -> String {
    SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
  }
}
