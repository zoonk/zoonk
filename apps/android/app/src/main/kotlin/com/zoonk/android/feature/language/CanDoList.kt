package com.zoonk.android.feature.language

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.api.models.LanguageProgressCanDoInner

/** Main's `CanDoList`: what the finished units taught the learner to do, then the next one ahead. */
@Composable
fun CanDoList(
    canDo: List<LanguageProgressCanDoInner>,
    modifier: Modifier = Modifier,
) {
    val shown = canDo.filter { it.done } + listOfNotNull(canDo.firstOrNull { !it.done })
    if (shown.isEmpty()) return
    val style = MaterialTheme.typography.bodyMedium
    val line = with(LocalDensity.current) { style.lineHeight.toDp() }
    val notYet = stringResource(R.string.language_can_do_not_yet)

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        SectionHeader(stringResource(R.string.language_can_already))
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            shown.forEach { item ->
                Row(
                    modifier = Modifier.semantics(mergeDescendants = true) { if (!item.done) stateDescription = notYet },
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(Modifier.height(line), contentAlignment = Alignment.Center) { CanDoMark(item.done) }
                    Text(
                        text = item.text,
                        color = if (item.done) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                        style = style,
                    )
                }
            }
        }
    }
}
