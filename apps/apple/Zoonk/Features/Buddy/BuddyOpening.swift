import Foundation

/// What decides the conversation the Buddy page opens.
struct BuddyOpening: Equatable {
  /// Only whether the list is read yet, and which conversation it opens.
  enum ListRead: Equatable {
    case waiting
    case read(currentId: String?)

    init(_ state: LoadState<BuddyConversations>) {
      switch state {
      case .loaded(let page): self = .read(currentId: page.currentId)
      case .empty: self = .read(currentId: nil)
      case .idle, .loading, .failed: self = .waiting
      }
    }
  }

  let goalId: String?
  let request: BuddyRequest?
  let isOpen: Bool
  /// Nil for a learner with no list, such as a guest.
  let list: ListRead?

  /// A link's or search's request first. Otherwise a visit with nothing open opens the
  /// conversation the learner asked in today, or a new one, once the list says which; one already
  /// open stays. Nil leaves the page as it is.
  static func next(request: BuddyRequest?, isOpen: Bool, list: ListRead?) -> BuddyRequest? {
    if let request {
      return request
    }

    guard !isOpen else {
      return nil
    }

    switch list {
    case nil, .read(currentId: nil):
      return .new(ask: nil)
    case .read(let currentId?):
      return .conversation(id: currentId)
    case .waiting:
      return nil
    }
  }
}
