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

  /// Removes the shared session credential so iCloud Keychain can propagate sign-out to the user's other Apple devices.
  func delete() throws {
    let status = SecItemDelete(matchQuery as CFDictionary)

    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw SessionCredentialStoreError.keychain(status)
    }
  }

  /// Reads the opaque Zoonk bearer token from Keychain without exposing provider credentials to the application.
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

  /// Updates one synchronizable Keychain item so the same revocable Zoonk session can follow a user between supported Apple devices.
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

  /// Inserts the credential only when no matching item exists, preserving a single source of truth in the user's Keychain.
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

  /// Keeps UI tests isolated from the simulator's real Keychain and from any iCloud account signed into the host.
  func delete() throws {
    token = nil
  }

  /// Returns only the credential created during the current test process.
  func read() throws -> String? {
    token
  }

  /// Stores a process-local credential so UI tests can exercise state transitions without affecting a real account.
  func save(_ token: String) throws {
    self.token = token
  }
}
