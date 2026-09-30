import Foundation

/// Restarts a detail page's load when the resource or the signed-in session changes.
struct CatalogDetailTaskID<Resource: Equatable>: Equatable {
  let resource: Resource
  let session: AuthenticatedSession?
}
