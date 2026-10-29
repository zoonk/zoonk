package com.zoonk.android.feature.questions

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.theme.withTabularFigures

/**
 * Pairs matched by tapping an entry on the left, then its match on the right (main's
 * `MatchPairsQuestion`); tapping a matched entry undoes its pair. The host gets the pairs once
 * every entry on the left has one, null before.
 */
@Composable
fun MatchPairsQuestion(
    left: List<String>,
    right: List<String>,
    enabled: Boolean,
    onAnswer: (Answer?) -> Unit,
    modifier: Modifier = Modifier,
) {
    var matches by rememberSaveable { mutableStateOf(List(left.size) { UNMATCHED }) }
    var selected by rememberSaveable { mutableStateOf<Int?>(null) }

    fun update(next: List<Int>) {
        matches = next
        onAnswer(if (next.none { it == UNMATCHED }) Answer.Matches(next) else null)
    }

    fun pickLeft(index: Int) {
        if (matches[index] != UNMATCHED) {
            update(matches.mapIndexed { position, match -> if (position == index) UNMATCHED else match })
        } else {
            selected = if (selected == index) null else index
        }
    }

    fun pickRight(index: Int) {
        val owner = matches.indexOf(index)
        val from = selected
        when {
            owner != UNMATCHED -> {
                update(matches.mapIndexed { position, match -> if (position == owner) UNMATCHED else match })
            }

            from != null -> {
                update(matches.mapIndexed { position, match -> if (position == from) index else match })
                selected = null
            }
        }
    }

    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        val column = Modifier.weight(1f)

        EntryColumn(column) {
            left.forEachIndexed { index, entry ->
                val pair = if (matches[index] != UNMATCHED) index + 1 else null
                Entry(entry, pair, picked = selected == index, enabled = enabled, onClick = { pickLeft(index) })
            }
        }

        EntryColumn(column) {
            right.forEachIndexed { index, entry ->
                val owner = matches.indexOf(index)
                val matched = owner != UNMATCHED
                val description =
                    if (matched) {
                        stringResource(
                            R.string.questions_matched_with,
                            plainItemLine(entry),
                            plainItemLine(left[owner]),
                        )
                    } else {
                        null
                    }
                Entry(
                    entry,
                    pair = if (matched) owner + 1 else null,
                    picked = false,
                    enabled = enabled && (selected != null || matched),
                    onClick = { pickRight(index) },
                    description = description,
                )
            }
        }
    }
}

/** TalkBack goes down one column, then the other. */
@Composable
private fun EntryColumn(
    modifier: Modifier,
    content: @Composable () -> Unit,
) {
    Column(modifier.semantics { isTraversalGroup = true }, verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
}

@Composable
private fun Entry(
    text: String,
    pair: Int?,
    picked: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    description: String? = null,
) {
    val tone = answerTone(picked = picked, result = null)
    val shape = RoundedCornerShape(12.dp)

    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .clip(shape)
            .background(tone.container)
            .border(tone.border, shape)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics {
                selected = picked
                if (description != null) contentDescription = description
            }.padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (pair != null) PairBadge(pair)
        ItemLine(text, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun PairBadge(number: Int) {
    Box(
        Modifier
            .clearAndSetSemantics {}
            .defaultMinSize(minWidth = 24.dp, minHeight = 24.dp)
            .background(MaterialTheme.colorScheme.onSurface, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = number.toString(),
            modifier = Modifier.padding(horizontal = 4.dp),
            color = MaterialTheme.colorScheme.surface,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        )
    }
}

private const val UNMATCHED = -1
