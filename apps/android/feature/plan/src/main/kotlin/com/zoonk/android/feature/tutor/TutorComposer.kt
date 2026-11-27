package com.zoonk.android.feature.tutor

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.FilledIconButton
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.composerColors
import com.zoonk.android.ui.components.composerFocusThickness
import com.zoonk.android.ui.components.fitTo
import com.zoonk.android.ui.components.limitLifted
import com.zoonk.android.ui.components.sendButtonColors
import com.zoonk.android.ui.components.submitOnEnter
import com.zoonk.android.ui.theme.ZoonkRadius

@Composable
internal fun TutorComposer(
    vm: TutorViewModel,
    turns: List<TutorTurn>?,
    state: TutorConversationState,
    routes: TutorRoutes,
    modifier: Modifier = Modifier,
    placeholder: String,
    focus: FocusRequester = remember { FocusRequester() },
) {
    val limit = turns?.let(state::limit)
    val lifted = limitLifted(limit)
    if (lifted) LaunchedEffect(limit) { vm.limitLifted() }

    val failure = state.askFailure
    // Main keeps the composer shut until the learner signs in again, sees Plus, or leaves a gone lesson.
    val blocked = failure == TutorFailure.SignedOut || failure == TutorFailure.PlusRequired || failure == TutorFailure.Gone
    val resending = state.unresolvedQuestion != null
    val canAsk = turns != null && state.canAsk(turns) && !blocked
    val canSend = canAsk && (vm.draft.text.isNotBlank() || resending)
    // The draft is read when the key is pressed: an edit in the same frame isn't in this composition's `canSend`.
    val sendByKey = { if (canAsk && (vm.draft.text.isNotBlank() || resending)) vm.send() }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // Above the question the learner wrote, which waits there until the limit lifts.
        if (limit != null && !lifted) {
            LimitNotice(
                limit = limit,
                subject = LimitSubject.Messages,
                onCreateAccount = routes.createAccount,
                onSubscribe = routes.subscribe,
                // Main's `mb-4`: 16dp to the composer's line, with the column's 8 and the 2dp its 48dp touch target keeps above it.
                modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp).semantics { liveRegion = LiveRegionMode.Polite },
            )
        }

        OutlinedTextField(
            state = vm.draft,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .focusRequester(focus)
                    .submitOnEnter(vm.draft, sendByKey),
            placeholder = { Text(placeholder) },
            inputTransformation = InputTransformation.fitTo(MAX_QUESTION_LENGTH),
            lineLimits = TextFieldLineLimits.MultiLine(maxHeightInLines = MAX_LINES),
            colors = composerColors(),
            focusedBorderThickness = composerFocusThickness(),
            focusRing = false,
            shape = RoundedCornerShape(ZoonkRadius.xl),
            // Main's `min-h-11`: 44dp on one line, the send button 8dp in from the end on the last line.
            contentPadding = PaddingValues(start = 14.dp, end = SEND_INSET + SEND_SIZE + 12.dp, top = 10.dp, bottom = 10.dp),
            minHeight = COMPOSER_HEIGHT,
            endAction = {
                SendButton(
                    state.asking,
                    resending,
                    enabled = canSend,
                    onClick = vm::send,
                    modifier = Modifier.padding(end = SEND_INSET, bottom = 7.dp),
                )
            },
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Send),
            onKeyboardAction = { sendByKey() },
        )

        if (failure != null && failure !is TutorFailure.Refused) {
            Text(
                text =
                    if (failure == TutorFailure.Failed &&
                        resending
                    ) {
                        stringResource(R.string.tutor_error_last_question)
                    } else {
                        failureMessage(failure)
                    },
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Assertive },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        if (blocked) FailureAction(failure, routes, onRetry = vm::send, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun SendButton(
    asking: Boolean,
    resending: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val label = stringResource(if (resending) R.string.tutor_retry_last_question else R.string.tutor_send)

    // Main's small square send button, ink like the page's main action; Material's 48dp target stays around it.
    FilledIconButton(
        onClick = onClick,
        enabled = enabled,
        busy = asking,
        modifier = modifier.size(SEND_SIZE),
        shape = RoundedCornerShape(ZoonkRadius.lg),
        colors = sendButtonColors(),
    ) {
        Icon(
            painterResource(if (resending) R.drawable.ic_refresh else R.drawable.ic_arrow_upward),
            contentDescription = label,
            Modifier.size(SEND_ICON),
        )
    }
}

private val COMPOSER_HEIGHT = 44.dp
private val SEND_INSET = 8.dp
private val SEND_SIZE = 30.dp
private val SEND_ICON = 16.dp
private const val MAX_QUESTION_LENGTH = 2000
private const val MAX_LINES = 5
