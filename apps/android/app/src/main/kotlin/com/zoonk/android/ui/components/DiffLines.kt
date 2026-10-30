package com.zoonk.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.WORDS_MARK
import com.zoonk.android.ui.format.withWords
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk

enum class DiffKind { Added, Context, Removed }

enum class DiffTone { Good, Bad, Neutral }

/** An unlabeled line says its own side ("Leaves out", "Adds"), so TalkBack reads it without the list's labels. */
class DiffLine(
    val kind: DiffKind,
    val text: AnnotatedString,
    val tone: DiffTone? = null,
    val labeled: Boolean = true,
) {
    constructor(kind: DiffKind, text: String, tone: DiffTone? = null, labeled: Boolean = true) :
        this(kind, AnnotatedString(text), tone, labeled)
}

/** Main's `DiffLines`: [removed] and [added] name each side's lines for TalkBack. */
@Composable
fun DiffLines(
    lines: List<DiffLine>,
    added: String,
    removed: String? = null,
    modifier: Modifier = Modifier,
) {
    val shape = MaterialTheme.shapes.medium

    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
            .padding(vertical = 4.dp),
    ) {
        lines.forEach { line ->
            val (container, content) = line.colors()
            val label =
                when (line.kind) {
                    DiffKind.Added -> added
                    DiffKind.Removed -> removed
                    DiffKind.Context -> null
                }?.takeIf { line.labeled }
            val spoken = label?.let { withWords(stringResource(R.string.diff_line_spoken, it, WORDS_MARK), line.text) } ?: line.text
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(container)
                    .padding(horizontal = 12.dp, vertical = 3.dp)
                    .clearAndSetSemantics { text = spoken },
            ) {
                val style = MaterialTheme.typography.bodySmall.withTabularFigures()
                when (line.kind) {
                    DiffKind.Added -> Text("+ ", style = style, color = content)
                    DiffKind.Removed -> Text("− ", style = style, color = content)
                    DiffKind.Context -> Unit
                }
                Text(
                    line.text,
                    style = style,
                    color = content,
                    textDecoration =
                        if (line.tone == DiffTone.Neutral && line.kind == DiffKind.Removed) TextDecoration.LineThrough else null,
                )
            }
        }
    }
}

@Composable
private fun DiffLine.colors(): Pair<Color, Color> {
    val colors = MaterialTheme.colorScheme
    val good = colors.tertiaryContainer to colors.onTertiaryContainer
    return when {
        kind == DiffKind.Context -> Color.Transparent to colors.onSurfaceVariant

        tone == null && kind == DiffKind.Added -> good

        tone == null -> colors.errorContainer to colors.onErrorContainer

        tone == DiffTone.Good -> good

        // Pink means wrong; bad news is something to notice, so it takes the warning's soft amber.
        tone == DiffTone.Bad -> MaterialTheme.zoonk.warning.copy(alpha = WARNING_TINT) to MaterialTheme.zoonk.warningText

        kind == DiffKind.Added -> Color.Transparent to colors.onSurface

        else -> Color.Transparent to colors.onSurfaceVariant
    }
}

private const val WARNING_TINT = 0.12f
