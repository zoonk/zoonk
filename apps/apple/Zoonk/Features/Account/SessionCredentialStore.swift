import Foundation
import Security

protocol SessionCredentialStoring {
  func delete() throws
  func read() throws -> String?
  func save(_ token: String) throws
}

enum SessionCredentialStoreError: Error {
  case invalidData
  case keychain(OSStatus)
}

struct SessionCredentialStore: SessionCredentialStoring {
  private let account = "session"
  private let service = "com.zoonk.authentication"

  func delete() throws {
    let status = SecItemDelete(matchQuery as CFDictionary)

    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw SessionCredentialStoreError.keychain(status)
    }
  }

  func read() throws -> String? {
    var result: CFTypeRef?
    let status = SecItemCopyMatching(readQuery as CFDictionary, &result)

    if status == errSecItemNotFound {
      return nil
    }

    guard status == errSecSuccess else {
      throw SessionCredentialStoreError.keychain(status)
    }

    guard let data = result as? Data, let token = String(data: data, encoding: .utf8) else {
      throw SessionCredentialStoreError.invalidData
    }

    return token
  }

  /// Synchronizable, so the session follows the learner between their Apple devices.
  func save(_ token: String) throws {
    let data = Data(token.utf8)
    let status = SecItemUpdate(
      updateQuery as CFDictionary,
      [kSecValueData as String: data] as CFDictionary)

    if status == errSecItemNotFound {
      try add(data)
      return
    }

    guard status == errSecSuccess else {
      throw SessionCredentialStoreError.keychain(status)
    }
  }

  private var updateQuery: [String: Any] {
    matchQuery.merging([kSecAttrSynchronizable as String: true]) { _, newValue in
      newValue
    }
  }

  private var matchQuery: [String: Any] {
    [
      kSecAttrAccount as String: account,
      kSecAttrService as String: service,
      kSecAttrSynchronizable as String: kSecAttrSynchronizableAny,
      kSecClass as String: kSecClassGenericPassword,
    ]
  }

  private var readQuery: [String: Any] {
    matchQuery.merging([
      kSecMatchLimit as String: kSecMatchLimitOne,
      kSecReturnData as String: true,
    ]) { _, newValue in
      newValue
    }
  }

  private func add(_ data: Data) throws {
    let query: [String: Any] = [
      kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlocked,
      kSecAttrAccount as String: account,
      kSecAttrService as String: service,
      kSecAttrSynchronizable as String: true,
      kSecClass as String: kSecClassGenericPassword,
      kSecValueData as String: data,
    ]
    let status = SecItemAdd(query as CFDictionary, nil)

    guard status == errSecSuccess else {
      throw SessionCredentialStoreError.keychain(status)
    }
  }
}

final class InMemorySessionCredentialStore: SessionCredentialStoring {
  private var token: String?

  init(token: String? = nil) {
    self.token = token
  }

  func delete() throws {
    token = nil
  }

  func read() throws -> String? {
    token
  }

  func save(_ token: String) throws {
    self.token = token
  }
}
