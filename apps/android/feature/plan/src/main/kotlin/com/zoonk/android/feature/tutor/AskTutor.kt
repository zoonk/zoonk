package com.zoonk.android.feature.tutor

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.OutlinedIconButton

enum class AskTutorAppearance { Button, Icon, Row }

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
            OutlinedButton(onClick = { open = true }, modifier = modifier.semantics { contentDescription = label }) {
                Box(Modifier.size(BUTTON_AVATAR_SIZE)) { TutorAvatar(identity, BUTTON_AVATAR_SIZE) }
                Text(stringResource(R.string.tutor_ask, identity.name), Modifier.padding(start = 8.dp))
            }
        }

        AskTutorAppearance.Icon -> {
            IconButton(onClick = { open = true }, modifier = modifier.semantics { contentDescription = label }) {
                // Main's question bubble (lucide message-circle-question), for a learner without a buddy's face.
                if (identity.look == null) {
                    Icon(painterResource(R.drawable.ic_contact_support), contentDescription = null)
                } else {
                    TutorAvatar(identity, BUTTON_AVATAR_SIZE)
                }
            }
        }

        AskTutorAppearance.Row -> {
            ListRow(
                headline = { Text(label) },
                modifier = modifier,
                onClick = { open = true },
                leading = { TutorAvatar(identity, ROW_AVATAR_SIZE) },
            )
        }
    }

    if (open) TutorSheet(scope, app, navigator, identity, onDismiss = { open = false })
}

/**
 * Main's "Ask {buddy}" beside a task's main action, as on a lesson's screen: an icon, or [worded]
 * after a missed answer, opening the conversation about [scope].
 */
@Composable
fun TutorAskButton(
    scope: TutorScope,
    app: AppContainer,
    navigator: AppNavigator,
    worded: Boolean,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    TutorAskButton(scope, app, navigator, worded, open, onOpenChange = { open = it })
}

/** The ask button whose conversation the screen also opens from elsewhere, as a lesson's offers do. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TutorAskButton(
    scope: TutorScope,
    app: AppContainer,
    navigator: AppNavigator,
    worded: Boolean,
    open: Boolean,
    onOpenChange: (Boolean) -> Unit,
    lessonSuggestions: List<TutorSuggestion> = emptyList(),
    offer: TutorOffer? = null,
    onOfferTaken: () -> Unit = {},
) {
    val summary by app.learnerSummary.summary.collectShown()
    val identity = tutorIdentity(summary.value)
    val label = stringResource(R.string.tutor_ask, identity.name)

    if (worded) {
        OutlinedButton(onClick = { onOpenChange(true) }) {
            Icon(painterResource(R.drawable.ic_contact_support), contentDescription = null, Modifier.size(ButtonDefaults.IconSize))
            Text(label, Modifier.padding(start = ButtonDefaults.IconSpacing))
        }
    } else {
        TooltipBox(
            positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Above),
            tooltip = { PlainTooltip { Text(label) } },
            state = rememberTooltipState(),
        ) {
            OutlinedIconButton(onClick = { onOpenChange(true) }) {
                Icon(painterResource(R.drawable.ic_contact_support), contentDescription = label)
            }
        }
    }

    if (open) {
        TutorSheet(scope, app, navigator, identity, onDismiss = { onOpenChange(false) }, lessonSuggestions, offer, onOfferTaken)
    }
}

private val BUTTON_AVATAR_SIZE = 24.dp
private val ROW_AVATAR_SIZE = 24.dp
