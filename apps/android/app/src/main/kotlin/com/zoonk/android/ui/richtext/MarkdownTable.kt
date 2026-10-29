package com.zoonk.android.ui.richtext

enum class TableAlign { Start, Center, End }

internal data class MarkdownTable(
    val align: List<TableAlign?>,
    val header: List<String>,
    val rows: List<List<String>>,
)

private val DELIMITER_CELL = Regex("^:?-+:?$")
private val EDGE_PIPES = Regex("^\\||(?<!\\\\)\\|$")
private val CELL_PIPE = Regex("(?<!\\\\)\\|")
private const val ESCAPED_PIPE = "\\|"

private fun isRow(line: String?): Boolean = line?.contains('|') ?: false

private fun splitRow(line: String): List<String> =
    line
        .trim()
        .replace(EDGE_PIPES, "")
        .split(CELL_PIPE)
        .map { it.trim().replace(ESCAPED_PIPE, "|") }

private fun toAlign(cell: String): TableAlign? {
    val left = cell.startsWith(':')
    val right = cell.endsWith(':')

    return when {
        left && right -> TableAlign.Center
        right -> TableAlign.End
        left -> TableAlign.Start
        else -> null
    }
}

private fun readDelimiter(line: String?): List<TableAlign?>? {
    if (line == null || !isRow(line)) return null
    val cells = splitRow(line)
    return if (cells.all { DELIMITER_CELL.matches(it) }) cells.map(::toAlign) else null
}

private fun readTableStart(
    lines: List<String>,
    index: Int,
): List<TableAlign?>? {
    val header = lines.getOrNull(index)
    val align = readDelimiter(lines.getOrNull(index + 1))
    return if (header != null && isRow(header) && align != null && splitRow(header).size == align.size) align else null
}

/**
 * Where a table's rows stop: at a blank line or a line without a pipe. GFM would keep a sentence
 * written right under a table as one more row; writers mean it as text.
 */
private fun findRowsEnd(
    lines: List<String>,
    index: Int,
): Int {
    var end = index
    while (isRow(lines.getOrNull(end))) end++
    return end
}

private fun toCells(
    line: String,
    count: Int,
): List<String> {
    val cells = splitRow(line)
    return List(count) { cells.getOrElse(it) { "" } }
}

internal data class TableRead(
    val table: MarkdownTable,
    val end: Int,
)

internal fun readMarkdownTable(
    lines: List<String>,
    index: Int,
): TableRead? {
    val align = readTableStart(lines, index) ?: return null
    val end = findRowsEnd(lines, index + 2)

    return TableRead(
        table =
            MarkdownTable(
                align = align,
                header = toCells(lines[index], align.size),
                rows = lines.subList(index + 2, end).map { toCells(it, align.size) },
            ),
        end = end,
    )
}

/** The lines that belong to a table, so a question can split its data from its words (`findMarkdownTableLines`). */
fun findMarkdownTableLines(lines: List<String>): Set<Int> =
    lines.indices
        .flatMap { index ->
            val read = if (isRow(lines.getOrNull(index - 1))) null else readMarkdownTable(lines, index)
            read?.let { (index until it.end).toList() }.orEmpty()
        }.toSet()
