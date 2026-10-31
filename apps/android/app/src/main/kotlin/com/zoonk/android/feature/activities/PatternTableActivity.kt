package com.zoonk.android.feature.activities

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf20FieldsRowsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf20Value as PatternTableContent

private typealias PatternRow = PlayableLibraryStepAnyOfContentOneOf20FieldsRowsInner

val patternTableRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_badge_spot_pattern, R.drawable.ic_table) },
        canvas = { PatternTableActivity(it) },
    )

@Composable
private fun PatternTableActivity(props: ActivityProps) {
    val fields = (props.content as PatternTableContent).value.fields
    val blanks = fields.rows.indices.filter { fields.rows[it].blank }
    var filled by rememberSaveable { mutableStateOf(props.answer.assignmentPairs.orEmpty()) }
    var active by rememberSaveable { mutableStateOf(nextOpenBlank(blanks, null, filled)) }
    val activeRow = active?.let(fields.rows::getOrNull)
    val modelStem = commonStem(fields.rows.map { it.model })
    val newStem = commonStem(fields.rows.map { it.answer })
    val expected = props.expected.assignmentPairs.orEmpty()
    val choose = choose@{ ending: String ->
        val row = active ?: return@choose
        val next = filled + ("$row" to ending)
        filled = next
        active = nextOpenBlank(blanks, row, next) ?: row
        props.onAnswerChange(if (blanks.all { "$it" in next }) assignmentAnswer(next) else null)
    }

    ActivityCanvas(gap = 16.dp) {
        PatternGrid(
            listOf(
                listOf<@Composable () -> Unit>(
                    {},
                    { WordHeader(fields.modelWord, fields.modelMeaning) },
                    { WordHeader(fields.newWord, fields.newMeaning) },
                ),
            ) +
                fields.rows.mapIndexed { index, row ->
                    listOf(
                        {
                            Text(row.label, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium))
                            row.labelMeaning?.let {
                                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
                            }
                        },
                        { Form(row.model, modelStem) },
                        {
                            when {
                                !row.blank -> {
                                    Form(row.answer, newStem)
                                }

                                props.isChecked -> {
                                    CheckedBlank(blankStem(fields.choices, row.answer), filled["$index"], expected["$index"])
                                }

                                else -> {
                                    OpenBlank(
                                        row,
                                        blankStem(fields.choices, row.answer),
                                        filled["$index"],
                                        active == index,
                                        !props.isLocked,
                                    ) {
                                        active = index
                                    }
                                }
                            }
                        },
                    )
                },
        )
        if (!props.isChecked && activeRow != null) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    stringResource(R.string.activities_pattern_which_ending, activeRow.label),
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                )
                ActivitySelectGrid(
                    fields.choices,
                    label = stringResource(R.string.activities_pattern_endings, activeRow.label),
                    columns = if (fields.choices.size > SHORT_CHOICES) 4 else 3,
                ) { choice ->
                    ActivityTile(
                        picked = filled["$active"] == choice,
                        result = null,
                        onClick = { choose(choice) },
                        enabled = !props.isLocked,
                        role = Role.RadioButton,
                    ) {
                        Text("-$choice", style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        }
    }
}

/**
 * Main's pattern table, laid out as a browser lays out a table: columns wrap between words to fit
 * the width. When even the longest words don't fit (a large font on a phone), each row stacks its
 * label over its two forms instead, so the form the learner completes stays in view.
 */
@Composable
private fun PatternGrid(rows: List<List<@Composable () -> Unit>>) {
    val line = MaterialTheme.colorScheme.outlineVariant

    BoxWithConstraints(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surface)) {
        val available = constraints.maxWidth
        Layout(
            content = {
                rows.forEachIndexed { rowIndex, row ->
                    if (rowIndex > 0) Box(Modifier.background(line))
                    row.forEach { cell -> Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.Center) { cell() } }
                }
            },
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
        ) { measurables, _ ->
            val columns = rows.first().size
            val room = available - 16.dp.roundToPx()
            val divider = 1.dp.roundToPx()
            val header = measurables.take(columns)
            val body = measurables.drop(columns).chunked(columns + 1).map { it.first() to it.drop(1) }
            val cells = listOf(header) + body.map { it.second }
            val narrowest = (0 until columns).map { column -> cells.maxOf { it[column].minIntrinsicWidth(Int.MAX_VALUE) } }
            val stacked = narrowest.sum() > room
            val widths =
                if (stacked) {
                    List(columns) { room / (columns - 1) }
                } else {
                    tableWidths(
                        narrowest,
                        (0 until columns).map { column ->
                            cells.maxOf { it[column].maxIntrinsicWidth(Int.MAX_VALUE) }
                        },
                        room,
                    )
                }
            val width = if (stacked) room else widths.sum()

            /** Measures [row]'s cells at [cellWidths] as tall as the tallest, laying them side by side. */
            fun sideBySide(
                row: List<Measurable>,
                cellWidths: List<Int>,
            ): List<Pair<Placeable, Int>> {
                val height = row.indices.maxOf { row[it].minIntrinsicHeight(cellWidths[it]) }
                var x = 0
                return row.mapIndexed { index, cell ->
                    (cell.measure(Constraints.fixed(cellWidths[index], height)) to x).also {
                        x +=
                            cellWidths[index]
                    }
                }
            }

            val lines =
                cells
                    .mapIndexed { rowIndex, row ->
                        val rule =
                            if (rowIndex >
                                0
                            ) {
                                listOf(listOf(body[rowIndex - 1].first.measure(Constraints.fixed(width, divider)) to 0))
                            } else {
                                emptyList()
                            }
                        if (!stacked) {
                            rule + listOf(sideBySide(row, widths))
                        } else {
                            val label = row.first()
                            val labelHeight = if (rowIndex == 0) 0 else label.minIntrinsicHeight(room)
                            rule +
                                listOf(
                                    listOf(label.measure(Constraints.fixed(room, labelHeight)) to 0),
                                    sideBySide(row.drop(1), widths.drop(1)),
                                )
                        }
                    }.flatten()
            layout(width, lines.sumOf { line -> line.maxOf { it.first.height } }) {
                var y = 0
                lines.forEach { line ->
                    line.forEach { (cell, x) -> cell.placeRelative(x, y) }
                    y += line.maxOf { it.first.height }
                }
            }
        }
    }
}

@Composable
private fun WordHeader(
    word: String,
    meaning: String?,
) {
    Text(word, style = MaterialTheme.typography.titleMedium)
    meaning?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall) }
}

/** A form with its ending in the accent color. */
@Composable
private fun Form(
    form: String,
    stem: String,
) {
    val parts = splitForm(form, stem)
    val accent = MaterialTheme.zoonk.vizAccent
    Text(
        buildAnnotatedString {
            append(parts.stem)
            withStyle(SpanStyle(color = accent, fontWeight = FontWeight.SemiBold)) { append(parts.ending) }
        },
        style = MaterialTheme.typography.bodyLarge,
    )
}

@Composable
private fun OpenBlank(
    row: PatternRow,
    stem: String,
    chosen: String?,
    isActive: Boolean,
    enabled: Boolean,
    onSelect: () -> Unit,
) {
    val accent = MaterialTheme.zoonk.vizAccent
    val label = stringResource(R.string.activities_pattern_blank, row.label, stem + (chosen ?: "…"))
    val shape = RoundedCornerShape(12.dp)

    Row(
        Modifier
            .offset(x = (-8).dp)
            .heightIn(min = 48.dp)
            .widthIn(min = 96.dp)
            .clip(shape)
            .border(2.dp, if (isActive) accent else Color.Transparent, shape)
            .selectable(selected = isActive, enabled = enabled, role = Role.Button, onClick = onSelect)
            .clearAndSetSemantics { contentDescription = label }
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            buildAnnotatedString {
                append(stem)
                if (chosen != null) withStyle(SpanStyle(color = accent, fontWeight = FontWeight.SemiBold)) { append(chosen) }
            },
            style = MaterialTheme.typography.bodyLarge,
        )
        if (chosen == null) {
            val line = if (isActive) accent else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = HALF)
            Box(
                Modifier
                    .padding(start = 2.dp)
                    .size(width = 36.dp, height = 20.dp)
                    .background(if (isActive) accent.copy(alpha = SOFT) else Color.Transparent)
                    .drawBehind { drawLine(line, Offset(0f, size.height), Offset(size.width, size.height), strokeWidth = 2.dp.toPx()) },
            )
        }
    }
}

@Composable
private fun CheckedBlank(
    stem: String,
    chosen: String?,
    expected: String?,
) {
    val right = chosen != null && chosen == expected
    val colors = MaterialTheme.colorScheme
    val correction = stringResource(R.string.activities_pattern_correct, stem + expected.orEmpty())
    Text(
        buildAnnotatedString {
            withStyle(
                SpanStyle(
                    color = if (right) colors.onTertiaryContainer else colors.error,
                    textDecoration = if (right) null else TextDecoration.LineThrough,
                ),
            ) {
                append(stem)
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(chosen.orEmpty()) }
            }
            if (!right && expected != null) {
                append("  ")
                withStyle(SpanStyle(color = colors.onTertiaryContainer)) {
                    append(stem)
                    withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(expected) }
                }
            }
        },
        modifier =
            if (right ||
                expected == null
            ) {
                Modifier
            } else {
                Modifier.semantics { contentDescription = "${stem}${chosen.orEmpty()}, $correction" }
            },
        style = MaterialTheme.typography.bodyLarge,
    )
}

private const val SHORT_CHOICES = 3
private const val SOFT = 0.16f
private const val HALF = 0.5f

/**
 * A browser's automatic table widths: every column at its widest when that fits, sharing the rest;
 * otherwise each between its narrowest and widest in proportion; at its narrowest when even that doesn't fit.
 */
internal fun tableWidths(
    narrowest: List<Int>,
    widest: List<Int>,
    room: Int,
): List<Int> {
    val most = widest.sum()
    val least = narrowest.sum()
    return when {
        most <= room -> widest.map { it + (room - most) / widest.size }
        least >= room -> narrowest
        else -> narrowest.zip(widest) { low, high -> low + ((high - low).toLong() * (room - least) / (most - least)).toInt() }
    }
}
