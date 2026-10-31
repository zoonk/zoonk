package com.zoonk.android.feature.account

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R

/** Over every screen, so nothing else goes on until it's answered. */
@Composable
fun BirthYearDialogs(gate: BirthYearGate) {
    val prompt by gate.prompt.collectAsStateWithLifecycle()

    when (val shown = prompt) {
        is BirthYearPrompt.Question -> {
            BirthYearQuestion(shown, onAnswer = gate::answer, onClose = gate::close)
        }

        is BirthYearPrompt.BelowMinimumAge -> {
            BelowMinimumAgeMessage(shown, onClose = gate::closeBelowMinimumAge)
        }

        null -> {}
    }
}

/** No year is suggested, so nobody is nudged toward an age. */
@Composable
internal fun BirthYearQuestion(
    question: BirthYearPrompt.Question,
    onAnswer: (Long) -> Unit,
    onClose: () -> Unit,
) {
    var year by rememberSaveable { mutableStateOf("") }
    var answered by rememberSaveable { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    val canContinue = year.length == YEAR_DIGITS && !question.saving
    val error = question.error?.takeIf { year == answered }

    fun submit() {
        if (!canContinue) return
        answered = year
        onAnswer(year.toLong())
    }

    AlertDialog(
        onDismissRequest = onClose,
        properties = DialogProperties(dismissOnBackPress = question.canClose, dismissOnClickOutside = question.canClose),
        title = { Text(stringResource(R.string.account_birth_year_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(stringResource(R.string.account_birth_year_description))
                OutlinedTextField(
                    value = year,
                    onValueChange = { typed -> year = typed.filter(Char::isDigit).take(YEAR_DIGITS) },
                    modifier = Modifier.fillMaxWidth().focusRequester(focus),
                    label = { Text(stringResource(R.string.account_birth_year_label)) },
                    supportingText = error?.let { { Text(stringResource(it.message)) } },
                    isError = error != null,
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { submit() }),
                )
                LaunchedEffect(Unit) { focus.requestFocus() }
            }
        },
        confirmButton = {
            TextButton(onClick = ::submit, enabled = canContinue) { Text(stringResource(R.string.account_continue)) }
        },
        dismissButton =
            if (question.canClose) {
                { TextButton(onClick = onClose) { Text(stringResource(R.string.account_birth_year_not_now)) } }
            } else {
                null
            },
    )
}

/** An account can only be logged out from here; a visitor can close it any way. */
@Composable
internal fun BelowMinimumAgeMessage(
    stop: BirthYearPrompt.BelowMinimumAge,
    onClose: () -> Unit,
) {
    val ok = remember { FocusRequester() }
    val description =
        if (stop.logsOut) R.string.account_below_minimum_age_log_out_description else R.string.account_below_minimum_age_description

    AlertDialog(
        onDismissRequest = onClose,
        properties = DialogProperties(dismissOnBackPress = !stop.logsOut, dismissOnClickOutside = !stop.logsOut),
        title = { Text(stringResource(R.string.account_below_minimum_age_title)) },
        text = { Text(stringResource(description, stop.minimumAge)) },
        confirmButton = {
            TextButton(onClick = onClose, modifier = Modifier.focusRequester(ok)) {
                Text(stringResource(R.string.account_below_minimum_age_ok))
            }
            LaunchedEffect(Unit) { ok.requestFocus() }
        },
    )
}

private val BirthYearError.message: Int
    get() =
        when (this) {
            BirthYearError.Invalid -> R.string.account_birth_year_invalid
            BirthYearError.NotSaved -> R.string.account_birth_year_save_failed
        }

private const val YEAR_DIGITS = 4
