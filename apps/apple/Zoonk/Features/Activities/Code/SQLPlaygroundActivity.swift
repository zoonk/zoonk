import SwiftUI

extension ActivityRenderer {
  static let sqlPlayground = ActivityRenderer(
    template: "sqlPlayground",
    grade: SQLPlaygroundFields.grade
  ) { context, fields in
    SQLPlaygroundCanvas(context: context, fields: fields)
  }
}

struct SQLPlaygroundFields: Decodable, Sendable {
  struct Expected: Decodable, Sendable {
    let columns: [String]
    let orderMatters: Bool
    let rows: [[JSONValue]]

    /// Core's `gradeRows`: the same columns whatever their case, and the same rows, in order
    /// when order matters.
    func matches(_ result: SQLResult) -> Bool {
      guard result.columns.map({ $0.lowercased() }) == columns.map({ $0.lowercased() }) else {
        return false
      }

      if orderMatters {
        return result.rows == rows
      }

      var remaining = rows
      for row in result.rows {
        guard let index = remaining.firstIndex(of: row) else {
          return false
        }

        remaining.remove(at: index)
      }

      return remaining.isEmpty
    }
  }

  struct Table: Decodable, Sendable {
    struct Column: Decodable, Sendable {
      let name: String
      let type: String
    }

    let columns: [Column]
    let name: String
    let rows: [[JSONValue]]
  }

  struct Mistake: Decodable, Sendable {
    let feedback: String
    let mistake: String
  }

  let expected: Expected
  let mistakes: [Mistake]
  let solution: String
  let tables: [Table]

  static func grade(_ content: ActivityStepContent, _ answer: ActivityAnswer) -> Bool {
    guard answer.kind == "rows", let fields = try? content.fields(as: Self.self),
      let result = try? answer.decode(as: SQLResult.self)
    else {
      return false
    }

    return fields.expected.matches(result)
  }

  /// Mirrors main's `sqlSnippets`. Keywords and tables add a space after themselves.
  var snippets: [SnippetKey] {
    let all =
      ["SELECT", "FROM", "WHERE", "AND", "OR", "ORDER BY", "DESC", "GROUP BY", "COUNT(*)"].map {
        SnippetKey(label: $0, before: $0 + " ")
      }
      + tables.flatMap {
        [SnippetKey(label: $0.name, before: $0.name + " ")]
          + $0.columns.map { SnippetKey(label: $0.name, before: $0.name) }
      }
    return all.enumerated().filter { index, snippet in
      all.firstIndex { $0.label == snippet.label } == index
    }.map(\.element)
  }
}

extension ActivityAnswer {
  static func rows(_ result: SQLResult) -> ActivityAnswer? {
    try? ActivityAnswer(encoding: result)
  }
}

/// The rows of the last run are the answer.
private struct SQLPlaygroundCanvas: View {
  let context: ActivityCanvasContext
  let fields: SQLPlaygroundFields

  @State private var runner = CodeSQLRunner()
  @ActivityState private var query: String
  @State private var selection: TextSelection?
  @ActivityState private var queryRun: SQLRun?
  @State private var activeRun: UUID?
  @State private var revision = 0
  @ActivityState("isStale") private var isStale = false
  @State private var verifiedSolution: String?
  @State private var runtime = CodeRuntimeStatus.loading
  @State private var runtimeAttempt = 0

  init(context: ActivityCanvasContext, fields: SQLPlaygroundFields) {
    self.context = context
    self.fields = fields
    _query = ActivityState(wrappedValue: context.phase == .explore ? fields.solution : "", "query")
    _queryRun = ActivityState(
      wrappedValue: (try? context.answer?.decode(as: SQLResult.self)).map(SQLRun.done), "queryRun")
  }

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  private var isCorrect: Bool {
    if case .checked(let isCorrect) = context.phase { isCorrect } else { false }
  }

  private var result: SQLResult? {
    if case .done(let result) = queryRun { result } else { nil }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ForEach(fields.tables, id: \.name) { table in
        SQLTableViewer(table: table)
      }

      if !isChecked || !query.isEmpty {
        editor
      }

      if let errorLine {
        Text(errorLine)
          .typeStyle(.body.monospaced())
          .foregroundStyle(.destructiveText)
      }

      if let result {
        resultView(result)
      }

      if isChecked {
        review
      }
    }
    .announcesStatus(errorLine)
    .announcesStatus(result.map(resultLine))
    .task(id: runtimeAttempt) {
      runtime = .loading
      runtime = await runner.warmUp() ? .ready : .failed
    }
    .task(id: isChecked) {
      guard isChecked else {
        return
      }

      // Shown only once code has run it and it passes the learner's check, so a solution the
      // writer got wrong is never shown as one that works.
      let solution = fields.solution
      let run = await runner.run(query: solution, tables: fields.tables)
      if case .done(let result) = run, fields.expected.matches(result) {
        verifiedSolution = solution
      }
    }
    .onChange(of: query) {
      revision += 1
      isStale = true
      context.setAnswer(nil)
    }
    // A run still going at Check ends unseen, so the answer keeps the result it was graded on.
    .onChange(of: isChecked) {
      activeRun = nil
    }
    .onDisappear {
      activeRun = nil
      runner.close()
    }
  }

  private var editor: some View {
    VStack(alignment: .leading, spacing: 8) {
      editorLabel
        .typeStyle(.meta.weight(.medium))
        .foregroundStyle(.mutedForeground)
        .accessibilityHidden(true)

      // A checked query stays as it was run, read-only.
      if isChecked {
        Text(CodeHighlight.colored(query, language: "sql"))
          .typeStyle(.body.monospaced())
          .textSelection(.enabled)
          .frame(maxWidth: .infinity, alignment: .leading)
          .fieldBorder()
          .accessibilityLabel(editorLabel)
          .accessibilityValue(Text(verbatim: query))
      } else {
        MultilineTextField(
          text: $query, selection: $selection, prompt: Text(verbatim: "SELECT"), label: editorLabel
        )
        .codeColors(query, language: "sql")
        .lineLimit(3...)
        .typeStyle(.body.monospaced())
        .textFieldStyle(.plain)
        .fieldBorder()
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .keyboardType(.asciiCapable)
      }

      CodeSnippetBar(
        snippets: fields.snippets,
        label: Text(
          "SQL words, tables and columns", tableName: "ActivitiesCode",
          comment: "VoiceOver: buttons that type SQL"),
        isEnabled: !isChecked
      ) { snippet in
        snippet.insert(into: &query, selection: &selection)
      }

      CodeRunBar(
        runtimeName: "SQLite", status: runtime, hasRun: queryRun != nil,
        isExploring: context.phase == .explore, isRunning: activeRun != nil,
        canRun: !isChecked && !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
        run: runQuery, retry: { runtimeAttempt += 1 })
    }
  }

  private var editorLabel: Text {
    Text("Query", tableName: "ActivitiesCode")
  }

  @ViewBuilder
  private func resultView(_ result: SQLResult) -> some View {
    let marks: [SQLRowsTable.Mark]? =
      isChecked
      ? compare(result.rows, with: fields.expected.rows).map { $0 ? .plain : .extra } : nil

    VStack(alignment: .leading, spacing: 6) {
      Text(resultLine(result))
        .typeStyle(.body.weight(.medium))

      if !result.columns.isEmpty {
        SQLRowsTable(
          caption: Text(
            "Your result", tableName: "ActivitiesCode",
            comment: "VoiceOver: the rows a query returned"),
          columns: result.columns, rows: result.rows, marks: marks)
      }
    }
    .opacity(isStale ? 0.6 : 1)

    if isStale {
      ActivityCaption(
        Text(
          "You changed the query. Run it again to see the new result.", tableName: "ActivitiesCode",
          comment: "Under the result of a query the learner edited since running it"))
    }
  }

  @ViewBuilder
  private var review: some View {
    if !isCorrect {
      let expected = fields.expected

      VStack(alignment: .leading, spacing: 6) {
        Group {
          if expected.orderMatters {
            Text(
              "Expected result, in this order", tableName: "ActivitiesCode",
              comment: "Rows a query should return, in order")
          } else {
            Text(
              "Expected result", tableName: "ActivitiesCode", comment: "Rows a query should return")
          }
        }
        .typeStyle(.body.weight(.medium))

        SQLRowsTable(
          caption: Text(
            "Expected result", tableName: "ActivitiesCode", comment: "Rows a query should return"),
          columns: expected.columns, rows: expected.rows,
          marks: compare(expected.rows, with: result?.rows ?? []).map { $0 ? .plain : .missing })
      }

      if !fields.mistakes.isEmpty {
        ActivityReasonList(
          reasons: fields.mistakes.map {
            .init(id: $0.mistake, text: "**\($0.mistake)**", why: $0.feedback)
          })
      }
    }

    if let verifiedSolution {
      VStack(alignment: .leading, spacing: 6) {
        Text(
          "A query that works", tableName: "ActivitiesCode",
          comment: "The lesson's own query, after the check"
        )
        .typeStyle(.body.weight(.medium))

        GroupBox {
          CodeListing(code: verifiedSolution, language: "sql")
        }
      }
    }
  }

  /// Mirrors main's `compareRows`: row by row in order when order matters, as a set otherwise.
  private func compare(_ rows: [[JSONValue]], with other: [[JSONValue]]) -> [Bool] {
    rows.enumerated().map { index, row in
      fields.expected.orderMatters
        ? other.indices.contains(index) && other[index] == row : other.contains(row)
    }
  }

  private var errorLine: String? {
    guard let queryRun, !isStale else {
      return nil
    }

    switch queryRun {
    case .done, .unavailable:
      return nil
    case .error(let message):
      return message
    case .timeout:
      return String(
        localized:
          "The query took more than \(CodeSQLRunner.timeLimitSeconds) seconds and was stopped.",
        table: "ActivitiesCode", locale: .appLanguage, comment: "A SQL query ran out of time")
    case .tooManyRows:
      return String(
        localized: "The query returned too many rows. Is a join missing its condition?",
        table: "ActivitiesCode",
        comment:
          "A query returned more rows than a lesson's small tables could need, most often by joining tables without saying how they match"
      )
    }
  }

  private func resultLine(_ result: SQLResult) -> String {
    if result.columns.isEmpty {
      return String(
        localized: "The query ran but didn't return a table. Use SELECT to get rows.",
        table: "ActivitiesCode", comment: "A SQL statement that returned no table")
    }

    if result.rows.isEmpty {
      return String(
        localized: "Your result has no rows", table: "ActivitiesCode",
        comment: "A query returned no rows")
    }

    return String(
      localized: "Your result: \(result.rows.count) rows", table: "ActivitiesCode",
      locale: .appLanguage, comment: "How many rows a query returned")
  }

  private func runQuery() {
    guard !isChecked, activeRun == nil,
      !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    else {
      return
    }

    let id = UUID()
    let started = revision
    let sql = query
    activeRun = id

    Task {
      let run = await runner.run(query: sql, tables: fields.tables)

      guard activeRun == id else {
        return
      }

      activeRun = nil
      queryRun = run
      isStale = revision != started
      // A worker a timeout ended reloads sql.js on the next run, which can fail offline.
      if run == .unavailable {
        runtime = .failed
      }
      context.setAnswer(
        isStale ? nil : { if case .done(let result) = run { .rows(result) } else { nil } }())
    }
  }
}

private struct SQLTableViewer: View {
  let table: SQLPlaygroundFields.Table

  @ActivityState private var isExpanded: Bool

  init(table: SQLPlaygroundFields.Table) {
    self.table = table
    _isExpanded = ActivityState(wrappedValue: table.rows.count <= 6, "isExpanded-\(table.name)")
  }

  private var rowCount: Text {
    Text(
      "\(table.rows.count) rows", tableName: "ActivitiesCode",
      comment: "How many rows a SQL table has")
  }

  var body: some View {
    VStack(spacing: 0) {
      DisclosureGroup(isExpanded: $isExpanded) {
        EmptyView()
      } label: {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
          Image(systemName: "tablecells")
            .foregroundStyle(.mutedForeground)

          Text(verbatim: table.name)
            .typeStyle(.body.weight(.semibold).monospaced())
            .foregroundStyle(Color(.foreground))

          if !isExpanded {
            Text(verbatim: table.columns.map(\.name).joined(separator: ", "))
              .typeStyle(.data)
              .foregroundStyle(.mutedForeground)
              .lineLimit(1)
          }

          Spacer(minLength: 0)

          Text(
            "\(table.rows.count) rows", tableName: "ActivitiesCode",
            comment: "How many rows a SQL table has"
          )
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .frame(minHeight: 44)
        .contentShape(.rect)
      }
      .accessibilityLabel(
        Text(
          "\(Text(verbatim: table.name)), \(rowCount)", tableName: "ActivitiesCode",
          comment: "VoiceOver: a SQL table's name, then how many rows it has")
      )
      .tint(.mutedForeground)
      .padding(.trailing, 14)
      if isExpanded {
        SQLRowsTable(
          caption: Text(
            "Table \(table.name)", tableName: "ActivitiesCode",
            comment: "VoiceOver: one of a lesson's SQL tables"),
          columns: table.columns.map(\.name), rows: table.rows, isEmbedded: true)
      }
    }
    .activityBox()
    .clipShape(.rect(cornerRadius: Radius.xl))
  }
}

private struct SQLRowsTable: View {
  enum Mark {
    case plain, extra, missing
  }

  let caption: Text
  let columns: [String]
  let rows: [[JSONValue]]
  var marks: [Mark]?
  var isEmbedded = false

  var body: some View {
    let table = HorizontalScroll {
      grid
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(caption)

    if isEmbedded {
      table
    } else {
      table
        .activityBox()
        .clipShape(.rect(cornerRadius: Radius.xl))
    }
  }

  private var grid: some View {
    Grid(alignment: .leading, horizontalSpacing: 0, verticalSpacing: 0) {
      GridRow {
        ForEach(Array(columns.enumerated()), id: \.offset) { index, column in
          Text(verbatim: column)
            .fixedSize()
            .typeStyle(.data)
            .foregroundStyle(.mutedForeground)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .gridColumnAlignment(isNumberColumn(index) ? .trailing : .leading)
        }
      }
      .anchorPreference(key: SQLRowBounds.self, value: .bounds) { [-1: [$0]] }
      .accessibilityHidden(true)

      ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
        let mark = mark(at: index)

        Divider()

        GridRow {
          ForEach(Array(row.enumerated()), id: \.offset) { _, value in
            SQLCell(value: value)
              .fixedSize()
              .padding(.horizontal, 12)
              .padding(.vertical, 8)
              .gridCellAnchor(value.isNumber ? .trailing : .leading)
          }
        }
        .anchorPreference(key: SQLRowBounds.self, value: .bounds) { [index: [$0]] }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(rowLabel(row, mark: mark))
      }
    }
    .typeStyle(.body)
    // GridRow distributes backgrounds to intrinsic cells, leaving gaps across wider tracks.
    .backgroundPreferenceValue(SQLRowBounds.self) { rows in
      GeometryReader { geometry in
        ForEach(rows.keys.sorted(), id: \.self) { row in
          let bounds = (rows[row] ?? []).reduce(CGRect.null) { $0.union(geometry[$1]) }
          Rectangle()
            .fill(row == -1 ? Color.muted : markColor(mark(at: row)))
            .frame(height: bounds.height)
            .offset(y: bounds.minY)
        }
      }
    }
  }

  private func mark(at index: Int) -> Mark {
    marks.flatMap { $0.indices.contains(index) ? $0[index] : nil } ?? .plain
  }

  private func isNumberColumn(_ index: Int) -> Bool {
    let values = rows.map { $0.indices.contains(index) ? $0[index] : .null }.filter { $0 != .null }
    return !values.isEmpty && values.allSatisfy(\.isNumber)
  }

  private func markColor(_ mark: Mark) -> Color {
    switch mark {
    case .plain: .clear
    case .extra: Color.destructive.opacity(0.1)
    case .missing: Color.success.opacity(0.1)
    }
  }

  private func rowLabel(_ row: [JSONValue], mark: Mark) -> Text {
    let cells = zip(columns, row).map { "\($0): \(SQLCell.text($1))" }.joined(separator: ", ")

    switch mark {
    case .plain:
      return Text(verbatim: cells)
    case .extra:
      return Text(
        "\(cells), not expected", tableName: "ActivitiesCode",
        comment: "VoiceOver: a result row the answer shouldn't have")
    case .missing:
      return Text(
        "\(cells), missing from your result", tableName: "ActivitiesCode",
        comment: "VoiceOver: an expected row the learner's result doesn't have")
    }
  }
}

private struct SQLRowBounds: PreferenceKey {
  static var defaultValue: [Int: [Anchor<CGRect>]] { [:] }

  static func reduce(
    value: inout [Int: [Anchor<CGRect>]], nextValue: () -> [Int: [Anchor<CGRect>]]
  ) {
    value.merge(nextValue()) { $0 + $1 }
  }
}

/// A cell as a query result prints it: numbers without grouping, NULL in SQL's own word.
private struct SQLCell: View {
  let value: JSONValue

  static func text(_ value: JSONValue) -> String {
    switch value {
    case .number(let number): ActivityNumberFormat.format(number, grouping: false)
    case .string(let text): text
    default: "NULL"
    }
  }

  var body: some View {
    if value == .null {
      Text(verbatim: "NULL")
        .italic()
        .foregroundStyle(.mutedForeground)
    } else {
      Text(verbatim: Self.text(value))
        .monospacedDigit()
    }
  }
}

extension JSONValue {
  fileprivate var isNumber: Bool {
    if case .number = self { true } else { false }
  }
}
