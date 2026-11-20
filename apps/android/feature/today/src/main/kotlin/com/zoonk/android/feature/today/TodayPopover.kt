package com.zoonk.android.feature.today

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RichTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipAnchorPosition
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.components.KindMark
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.format.FACT_SEPARATOR
import com.zoonk.android.ui.theme.Geist
import com.zoonk.android.ui.theme.zoonkType
import kotlinx.coroutines.launch

/** Main's Today popovers: tapping [anchor] opens a small note on what it shows, and a tap anywhere closes it. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun TodayPopover(
    title: String,
    facts: String?,
    note: String?,
    modifier: Modifier = Modifier,
    status: String? = null,
    kind: LearnKind? = null,
    footer: @Composable () -> Unit = {},
    anchor: @Composable (Modifier) -> Unit,
) {
    val state = rememberTooltipState(isPersistent = true)
    val scope = rememberCoroutineScope()

    // TooltipBox puts its modifier inside a Box of its own, where a Row's weight wouldn't reach.
    Box(modifier) {
        TooltipBox(
            positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Below),
            tooltip = {
                RichTooltip(
                    colors = TooltipDefaults.richTooltipColors(titleContentColor = MaterialTheme.colorScheme.onSurface),
                    title = {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                            if (kind != null) KindMark(kind)
                            Text(title)
                        }
                    },
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (status != null || facts != null) Text(factsWithStatus(status, facts), style = MaterialTheme.zoonkType.data)
                        if (note != null) Text(note)
                        footer()
                    }
                }
            },
            state = state,
        ) {
            anchor(Modifier.clickable(role = Role.Button) { scope.launch { state.show() } })
        }
    }
}

/** Main's: a state is words, in the text face; a time or a count is data, in mono. */
private fun factsWithStatus(
    status: String?,
    facts: String?,
): AnnotatedString =
    buildAnnotatedString {
        if (status != null) withStyle(SpanStyle(fontFamily = Geist)) { append(status) }
        if (status != null && facts != null) append(FACT_SEPARATOR)
        if (facts != null) append(facts)
    }
