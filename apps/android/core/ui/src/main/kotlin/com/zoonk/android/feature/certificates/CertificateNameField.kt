package com.zoonk.android.feature.certificates

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
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
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.account.AccountStore
import kotlinx.coroutines.launch

/** Saves the profile name, which every certificate prints and the buddy calls the learner by. */
class CertificateNameModel(
    private val account: AccountStore,
) : ViewModel() {
    var isSaving by mutableStateOf(false)
        private set

    var failed by mutableStateOf(false)
        private set

    fun save(
        name: String,
        onSaved: () -> Unit,
    ) {
        if (isSaving || name.isBlank()) return
        isSaving = true
        failed = false
        viewModelScope.launch {
            val failure = account.saveProfile(name.trim())
            isSaving = false
            if (failure == null) onSaved() else failed = true
        }
    }
}

/**
 * Main's name field from the award moment. [current] null asks for a first name, which the
 * learner can't skip here; with a name, [onCancel] (or Back) leaves it unchanged.
 */
@Composable
fun CertificateNameField(
    app: AppContainer,
    current: String?,
    onSaved: () -> Unit,
    modifier: Modifier = Modifier,
    onCancel: (() -> Unit)? = null,
) {
    val model = viewModel { CertificateNameModel(app.account) }
    var name by rememberSaveable { mutableStateOf(current.orEmpty()) }
    val focus = remember { FocusRequester() }
    val save = { model.save(name, onSaved) }

    BackHandler(enabled = onCancel != null) { onCancel?.invoke() }
    LaunchedEffect(Unit) { if (current != null) focus.requestFocus() }

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            modifier =
                Modifier
                    .fillMaxWidth()
                    .focusRequester(focus)
                    .semantics { contentType = ContentType.PersonFullName },
            label = {
                Text(
                    stringResource(
                        if (current ==
                            null
                        ) {
                            R.string.certificates_name_label_new
                        } else {
                            R.string.certificates_name_label
                        },
                    ),
                )
            },
            placeholder = { Text(stringResource(R.string.certificates_name_placeholder)) },
            supportingText = {
                Text(stringResource(if (current == null) R.string.certificates_name_hint_new else R.string.certificates_name_hint))
            },
            singleLine = true,
            readOnly = model.isSaving,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { save() }),
        )

        if (model.failed) {
            Text(
                stringResource(R.string.certificates_name_save_failed),
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        Row(Modifier.align(Alignment.End), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            onCancel?.let { TextButton(onClick = it, enabled = !model.isSaving) { Text(stringResource(R.string.certificates_cancel)) } }
            Button(onClick = save, enabled = name.isNotBlank() && !model.isSaving) { Text(stringResource(R.string.certificates_save)) }
        }
    }
}
