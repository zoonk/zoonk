import Foundation
import UniformTypeIdentifiers

/// Mirrors the request `@vercel/blob`'s `uploadPresigned()` makes from a browser (API version 12),
/// so the app holds no store credentials.
enum BlobUpload {
  private static let apiURL = URL(string: "https://vercel.com/api/blob/")!
  private static let apiVersion = "12"

  static func put(
    file: URL,
    pathname: String,
    delegationToken: String,
    signature: String,
    params: [String: String]
  ) async throws {
    guard let storeID = storeID(in: delegationToken),
      var components = URLComponents(url: apiURL, resolvingAgainstBaseURL: false)
    else {
      throw APIError.unavailable
    }

    components.queryItems =
      [URLQueryItem(name: "pathname", value: pathname)]
      + params.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
      + [
        URLQueryItem(name: "vercel-blob-delegation", value: delegationToken),
        URLQueryItem(name: "vercel-blob-signature", value: signature),
      ]

    guard let url = components.url else {
      throw APIError.unavailable
    }

    var request = URLRequest(url: url)
    request.httpMethod = "PUT"
    request.setValue(apiVersion, forHTTPHeaderField: "x-api-version")
    request.setValue(storeID, forHTTPHeaderField: "x-vercel-blob-store-id")
    request.setValue(
      "\(storeID):\(Int(Date.now.timeIntervalSince1970 * 1000)):\(UUID().uuidString)",
      forHTTPHeaderField: "x-api-blob-request-id")
    request.setValue("0", forHTTPHeaderField: "x-api-blob-request-attempt")
    request.setValue("private", forHTTPHeaderField: "x-vercel-blob-access")

    if let type = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType {
      request.setValue(type, forHTTPHeaderField: "x-content-type")
    }

    let (_, response) = try await URLSession.shared.upload(for: request, fromFile: file)

    guard let status = (response as? HTTPURLResponse)?.statusCode, (200..<300).contains(status)
    else {
      throw APIError.unavailable
    }
  }

  /// A delegation token's first segment is base64url JSON with `storeId`.
  static func storeID(in delegationToken: String) -> String? {
    struct Payload: Decodable {
      let storeId: String
    }

    guard let segment = delegationToken.split(separator: ".").first else {
      return nil
    }

    var base64 = String(segment).replacing("-", with: "+").replacing("_", with: "/")
    base64 += String(repeating: "=", count: (4 - base64.count % 4) % 4)

    guard let data = Data(base64Encoded: base64),
      let storeID = try? JSONDecoder().decode(Payload.self, from: data).storeId
    else {
      return nil
    }

    return storeID.hasPrefix("store_") ? String(storeID.dropFirst("store_".count)) : storeID
  }
}
