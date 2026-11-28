import Foundation
import PackagePlugin

@main
struct GenerateAPIClient: BuildToolPlugin {
  private static let generatedFiles = [
    "Client.swift",
    "Types.swift",
    "Types+Components.swift",
    "Types+Components+Headers.swift",
    "Types+Components+Parameters.swift",
    "Types+Components+RequestBodies.swift",
    "Types+Components+Responses.swift",
    "Types+Components+Schemas.swift",
    "Types+Operations.swift",
  ]

  private static let shardCounts = [
    "Client": 32,
    "Types+Components+Schemas": 96,
    "Types+Operations": 64,
  ]

  func createBuildCommands(context: PluginContext, target: Target) throws -> [Command] {
    let document = target.directoryURL.appending(path: "openapi.json")
    let configuration = target.directoryURL.appending(path: "openapi-generator-config.yaml")
    let generator = try context.tool(named: "swift-openapi-generator").url
    let unsplit = context.pluginWorkDirectoryURL.appending(path: "Unsplit")
    let directory = context.pluginWorkDirectoryURL.appending(path: "GeneratedSources")

    let shards = Self.shardCounts.sorted { $0.key < $1.key }.flatMap { file, count in
      (0..<count).map { "\(file)+\($0).swift" }
    }

    let outputs = (Self.generatedFiles + shards).map { directory.appending(path: $0) }

    return [
      .buildCommand(
        displayName: "Generate the API client",
        executable: try context.tool(named: "GenerateSplitSources").url,
        arguments: [generator.path, document.path, configuration.path, unsplit.path]
          + outputs.map(\.path),
        inputFiles: [document, configuration, generator],
        outputFiles: outputs)
    ]
  }
}
