/// Mirrors core's `program-languages.ts`. JavaScript and Python run on the device
/// (`CodeProgramRunner`); every other language runs on our servers (`CodeRunAPI`).
enum CodeLanguage: String, Decodable, Sendable {
  case cpp, csharp, go, java, javascript, kotlin, php, python, ruby, rust, swift, typescript

  var runtimeName: String {
    switch self {
    case .cpp: "C++"
    case .csharp: "C#"
    case .go: "Go"
    case .java: "Java"
    case .javascript: "JavaScript"
    case .kotlin: "Kotlin"
    case .php: "PHP"
    case .python: "Python"
    case .ruby: "Ruby"
    case .rust: "Rust"
    case .swift: "Swift"
    case .typescript: "TypeScript"
    }
  }

  var defaultFileName: String {
    switch self {
    case .cpp: "main.cpp"
    case .csharp: "Program.cs"
    case .go: "main.go"
    case .java: "Main.java"
    case .javascript: "main.js"
    case .kotlin: "Main.kt"
    case .php: "main.php"
    case .python: "main.py"
    case .ruby: "main.rb"
    case .rust: "main.rs"
    case .swift: "main.swift"
    case .typescript: "main.ts"
    }
  }

  var runsOnDevice: Bool {
    self == .javascript || self == .python
  }

  /// Core's `PROGRAM_TIME_LIMIT_MS`, for a language that runs on the device.
  var timeLimitSeconds: Int {
    self == .python ? 5 : 3
  }
}
