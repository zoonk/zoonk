import CoreTransferable

/// What an activity's drag carries. Only this app can read it, so another app never receives an
/// internal id (`i1`) dropped onto it.
struct ActivityDragItem: Transferable {
  let id: String

  static var transferRepresentation: some TransferRepresentation {
    ProxyRepresentation(exporting: \.id, importing: { ActivityDragItem(id: $0) })
      .visibility(.ownProcess)
  }
}
