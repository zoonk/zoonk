package com.zoonk.android.feature.language

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.bleed
import com.zoonk.api.models.LanguageProgressCanDoInner

/** Main's `CanDoList`: what the finished units taught the learner to do, then the next one ahead; nothing until a unit is done. */
@Composable
fun CanDoList(
    canDo: List<LanguageProgressCanDoInner>,
    modifier: Modifier = Modifier,
) {
    val done = canDo.filter { it.done }
    val next = canDo.firstOrNull { !it.done }
    if (done.isEmpty()) return

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.language_can_already))
        Column(Modifier.bleed(LIST_ITEM_INSET)) {
            done.forEach { CanDoRow(it.text, done = true) }
            next?.let { CanDoRow(it.text, done = false, notYet = true) }
        }
    }
}

/** Something a unit teaches the learner to do; [notYet] is the next one, which TalkBack hears isn't done. */
@Composable
fun CanDoRow(
    text: String,
    done: Boolean,
    notYet: Boolean = false,
) {
    ListRow(
        headline = { Text(text, color = if (notYet) MaterialTheme.colorScheme.onSurfaceVariant else Color.Unspecified) },
        stateDescription = if (notYet) stringResource(R.string.language_can_do_not_yet) else null,
        leading = { CanDoMark(done) },
    )
}
