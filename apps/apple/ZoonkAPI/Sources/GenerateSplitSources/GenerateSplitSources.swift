import Foundation

/// swift-openapi-generator writes its code into three very large files, and the compiler holds a
/// whole file in memory. Spreading their declarations over smaller files, by name, keeps a build
/// within CI's memory and a contract change from recompiling all of them.
@main
struct GenerateSplitSources {
  static func main() {
    do {
      try generate(arguments: Array(CommandLine.arguments.dropFirst()))
    } catch {
      FileHandle.standardError.write(Data("error: \(error)\n".utf8))
      exit(1)
    }
  }

  private static func generate(arguments: [String]) throws {
    guard arguments.count > 4 else {
      throw Failure("usage: <generator> <document> <configuration> <unsplit folder> <output>...")
    }

    let unsplit = URL(fileURLWithPath: arguments[3])
    let outputs = arguments[4...].map { URL(fileURLWithPath: $0) }

    try? FileManager.default.removeItem(at: unsplit)

    try run(
      URL(fileURLWithPath: arguments[0]),
      [
        "generate", arguments[1], "--config", arguments[2], "--output-directory", unsplit.path,
      ])

    for output in outputs where !Namespace.all.contains(where: { $0.isShard(output) }) {
      let generated = try String(
        contentsOf: unsplit.appendingPathComponent(output.lastPathComponent), encoding: .utf8)

      guard let namespace = Namespace.all.first(where: { $0.file == output.lastPathComponent })
      else {
        try write(generated, to: output)
        continue
      }

      let shards = outputs.filter(namespace.isShard)
      let split = try namespace.split(generated, into: shards.count)
      try write(split.kept, to: output)

      for (shard, contents) in zip(shards, split.shards) {
        try write(contents, to: shard)
      }
    }
  }

  private static func run(_ executable: URL, _ arguments: [String]) throws {
    let process = Process()
    process.executableURL = executable
    process.arguments = arguments
    try process.run()
    process.waitUntilExit()

    guard process.terminationStatus == 0 else {
      throw Failure("\(executable.lastPathComponent) exited with \(process.terminationStatus)")
    }
  }

  /// A file whose contents didn't change keeps its date, so the compiler skips it.
  private static func write(_ contents: String, to url: URL) throws {
    let data = Data(contents.utf8)

    if (try? Data(contentsOf: url)) != data {
      try FileManager.default.createDirectory(
        at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
      try data.write(to: url)
    }
  }
}

struct Failure: Error, CustomStringConvertible {
  let description: String

  init(_ description: String) {
    self.description = description
  }
}
