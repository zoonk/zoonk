package com.zoonk.android.feature.tutor

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.PlainTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TooltipAnchorPosition
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator

enum class AskTutorAppearance { Button, Row }

/**
 * Main's "Ask {buddy}" on a chapter, subject, mock or plan page: it opens the conversation about it
 * in a sheet, which keeps its draft and answer while the page is open.
 */
@Composable
fun AskTutor(
    scope: TutorScope,
    app: AppContainer,
    navigator: AppNavigator,
    modifier: Modifier = Modifier,
    appearance: AskTutorAppearance = AskTutorAppearance.Button,
) {
    val summary by app.learnerSummary.summary.collectShown()
    val identity = tutorIdentity(summary.value)
    val label = askLabel(scope, identity.name)
    var open by rememberSaveable { mutableStateOf(false) }

    when (appearance) {
        AskTutorAppearance.Button -> {
            FilledTonalButton(onClick = { open = true }, modifier = modifier.semantics { contentDescription = label }) {
                Box(Modifier.size(BUTTON_AVATAR_SIZE)) { TutorAvatar(identity, BUTTON_AVATAR_SIZE) }
                Text(stringResource(R.string.tutor_ask, identity.name), Modifier.padding(start = 8.dp))
            }
        }

        AskTutorAppearance.Row -> {
            ListItem(
                headlineContent = { Text(label) },
                modifier = modifier.clickable { open = true },
                leadingContent = { TutorAvatar(identity, ROW_AVATAR_SIZE) },
            )
        }
    }

    if (open) TutorSheet(scope, app, navigator, identity, onDismiss = { open = false })
}

/**
 * Main's "Ask {buddy}" beside a task's main action, as on a lesson's screen: an icon, or [worded]
 * after a missed answer, opening the conversation about [scope].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TutorAskButton(
    scope: TutorScope,
    app: AppContainer,
    navigator: AppNavigator,
    worded: Boolean,
    lessonSuggestions: List<TutorSuggestion> = emptyList(),
) {
    val summary by app.learnerSummary.summary.collectShown()
    val identity = tutorIdentity(summary.value)
    val label = stringResource(R.string.tutor_ask, identity.name)
    var open by rememberSaveable { mutableStateOf(false) }

    if (worded) {
        OutlinedButton(onClick = {
            open = true
        }, colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onSurface)) {
            Icon(painterResource(R.drawable.ic_contact_support), contentDescription = null, Modifier.size(ButtonDefaults.IconSize))
            Text(label, Modifier.padding(start = ButtonDefaults.IconSpacing))
        }
    } else {
        TooltipBox(
            positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Above),
            tooltip = { PlainTooltip { Text(label) } },
            state = rememberTooltipState(),
        ) {
            OutlinedIconButton(onClick = { open = true }) {
                Icon(painterResource(R.drawable.ic_contact_support), contentDescription = label)
            }
        }
    }

    if (open) TutorSheet(scope, app, navigator, identity, onDismiss = { open = false }, lessonSuggestions = lessonSuggestions)
}

private val BUTTON_AVATAR_SIZE = 24.dp
private val ROW_AVATAR_SIZE = 24.dp
