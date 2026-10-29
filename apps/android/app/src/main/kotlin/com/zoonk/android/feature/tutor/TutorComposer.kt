package com.zoonk.android.feature.tutor

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.InputTransformation
import androidx.compose.foundation.text.input.TextFieldLineLimits
import androidx.compose.foundation.text.input.maxLength
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.isShiftPressed
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject

@Composable
internal fun TutorComposer(
    vm: TutorViewModel,
    turns: List<TutorTurn>?,
    state: TutorConversationState,
    routes: TutorRoutes,
    modifier: Modifier = Modifier,
    placeholder: String = placeholderLabel(vm.scope),
) {
    val limit = turns?.let(state::limit)

    if (limit != null) {
        Surface(
            modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.large,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        ) {
            LimitNotice(
                limit = limit,
                subject = LimitSubject.Help,
                onCreateAccount = routes.createAccount,
                onSeePlus = routes.seePlus,
                modifier = Modifier.padding(16.dp).semantics { liveRegion = LiveRegionMode.Polite },
            )
        }
        return
    }

    val failure = state.askFailure
    // Main keeps the composer shut until the learner signs in again, sees Plus, or leaves a gone lesson.
    val blocked = failure == TutorFailure.SignedOut || failure == TutorFailure.PlusRequired || failure == TutorFailure.Gone
    val resending = state.unresolvedQuestion != null
    val canSend =
        turns != null && state.canAsk(turns) && !blocked && (vm.draft.text.isNotBlank() || resending)

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            state = vm.draft,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .onPreviewKeyEvent { event ->
                        val send = event.key == Key.Enter && !event.isShiftPressed
                        if (send && event.type == KeyEventType.KeyDown && canSend) vm.send()
                        send
                    },
            placeholder = { Text(placeholder, maxLines = 1, overflow = TextOverflow.Ellipsis) },
            trailingIcon = { SendButton(state.asking, resending, enabled = canSend, onClick = vm::send) },
            inputTransformation = InputTransformation.maxLength(MAX_QUESTION_LENGTH),
            lineLimits = TextFieldLineLimits.MultiLine(maxHeightInLines = MAX_LINES),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Send),
            onKeyboardAction = { if (canSend) vm.send() },
            shape = MaterialTheme.shapes.large,
        )

        if (failure != null) {
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
) {
    val label = stringResource(if (resending) R.string.tutor_retry_last_question else R.string.tutor_send)

    FilledIconButton(onClick = onClick, enabled = enabled, modifier = Modifier.padding(end = 4.dp)) {
        when {
            asking -> CircularProgressIndicator(Modifier.size(18.dp).semantics { contentDescription = label }, strokeWidth = 2.dp)
            resending -> Icon(painterResource(R.drawable.ic_refresh), contentDescription = label)
            else -> Icon(painterResource(R.drawable.ic_arrow_upward), contentDescription = label)
        }
    }
}

private const val MAX_QUESTION_LENGTH = 2000
private const val MAX_LINES = 5
