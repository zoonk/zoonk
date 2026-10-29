package com.zoonk.android.feature.account

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.zoonk.android.R

/**
 * Main's name and username fields. In [isSetup], as main's setup, the name takes focus and the
 * suggested username shows as a line with Change until the learner asks to edit it.
 */
@Composable
fun ProfileFields(
    form: ProfileFormViewModel,
    modifier: Modifier = Modifier,
    isSetup: Boolean = false,
) {
    val nameFocus = remember { FocusRequester() }
    var isEditingUsername by rememberSaveable { mutableStateOf(!isSetup) }
    val showsUsernameField =
        isEditingUsername || form.username.isEmpty() || form.failure == AccountFailure.UsernameTaken ||
            form.usernameStatus == UsernameStatus.Taken

    LaunchedEffect(Unit) { if (isSetup) nameFocus.requestFocus() }

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        OutlinedTextField(
            value = form.name,
            onValueChange = form::onNameChange,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .focusRequester(nameFocus)
                    .semantics { contentType = ContentType.PersonFullName },
            label = { Text(stringResource(R.string.account_name)) },
            supportingText = if (isSetup) null else ({ Text(stringResource(R.string.account_name_description)) }),
            singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Next),
        )

        if (showsUsernameField) {
            UsernameField(form)
        } else {
            val change = stringResource(R.string.account_change_username)

            FlowRow {
                Text(
                    text = stringResource(R.string.account_username_line, form.username),
                    modifier = Modifier.align(Alignment.CenterVertically),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
                TextButton(
                    onClick = { isEditingUsername = true },
                    modifier = Modifier.semantics { contentDescription = change },
                ) { Text(stringResource(R.string.account_change)) }
            }
        }
    }
}

@Composable
private fun UsernameField(form: ProfileFormViewModel) {
    val status = form.usernameStatus
    val isWrong = status == UsernameStatus.Invalid || status == UsernameStatus.Taken

    OutlinedTextField(
        value = form.username,
        onValueChange = form::onUsernameChange,
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics { contentType = ContentType.Username },
        label = { Text(stringResource(R.string.account_username)) },
        prefix = { Text("@") },
        supportingText = {
            Text(
                text =
                    when (status) {
                        UsernameStatus.Checking -> stringResource(R.string.account_username_checking)
                        UsernameStatus.Available -> stringResource(R.string.account_username_available, form.username)
                        UsernameStatus.Taken -> stringResource(R.string.account_username_taken, form.username)
                        UsernameStatus.Idle, UsernameStatus.Invalid -> stringResource(R.string.account_username_rules)
                    },
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            )
        },
        isError = isWrong,
        singleLine = true,
        keyboardOptions =
            KeyboardOptions(
                capitalization = KeyboardCapitalization.None,
                autoCorrectEnabled = false,
                keyboardType = KeyboardType.Ascii,
                imeAction = ImeAction.Done,
            ),
    )
}

@Composable
fun ProfileSaveFailure(form: ProfileFormViewModel) {
    val message =
        when (form.failure) {
            null, AccountFailure.UsernameTaken -> return
            AccountFailure.Network -> stringResource(R.string.account_failure_network)
            else -> stringResource(R.string.account_save_failed)
        }
    FailureText(message)
}

@Composable
internal fun FailureText(
    message: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = message,
        modifier = modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}
