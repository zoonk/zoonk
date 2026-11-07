package com.zoonk.android.feature.certificates

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.account.AccountStore
import com.zoonk.android.feature.account.isNameChangeTooLong
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.TextButton
import kotlinx.coroutines.launch

/**
 * Saves the profile name, which every certificate prints and the buddy calls the learner by. The
 * name being typed and whether the learner is [changing] the one they have live in the saved state,
 * so they survive folding (which moves the field between pages) and a save that ends after it.
 */
class CertificateNameModel(
    private val account: AccountStore,
    private val saved: SavedStateHandle,
) : ViewModel() {
    var name by mutableStateOf(saved.get<String>(NAME).orEmpty())
        private set

    var changing by mutableStateOf(saved.get<Boolean>(CHANGING) == true)
        private set

    var isSaving by mutableStateOf(false)
        private set

    var failed by mutableStateOf(false)
        private set

    fun type(text: String) {
        name = text
        saved[NAME] = text
    }

    fun change(current: String) {
        type(current)
        changing = true
        saved[CHANGING] = true
    }

    fun stop() {
        changing = false
        saved[CHANGING] = false
    }

    /** [current] is the saved name, or null when there's none yet. */
    fun save(current: String?) {
        val trimmed = name.trim()
        if (isSaving || trimmed.isEmpty() || isNameChangeTooLong(trimmed, current.orEmpty())) return
        if (trimmed == current) {
            stop()
            return
        }
        isSaving = true
        failed = false
        viewModelScope.launch {
            val failure = account.saveProfile(trimmed)
            isSaving = false
            if (failure == null) stop() else failed = true
        }
    }

    private companion object {
        const val NAME = "name"
        const val CHANGING = "changing"
    }
}

/** The name model of the screen it's called from; [key] tells apart moments the same screen shows. */
@Composable
fun certificateNameModel(
    app: AppContainer,
    key: String? = null,
): CertificateNameModel = viewModel(key = key) { CertificateNameModel(app.account, createSavedStateHandle()) }

/**
 * Main's name field from the award moment. [current] null asks for a first name, which the learner
 * can't skip here; with a name, Cancel (or Back) leaves it unchanged.
 */
@Composable
fun CertificateNameField(
    current: String?,
    model: CertificateNameModel,
    modifier: Modifier = Modifier,
) {
    val focus = remember { FocusRequester() }
    val name = model.name
    val isTooLong = isNameChangeTooLong(name, current.orEmpty())
    val save = { model.save(current) }

    BackHandler(enabled = current != null, onBack = model::stop)
    LaunchedEffect(Unit) { if (current != null) focus.requestFocus() }

    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
            value = name,
            onValueChange = model::type,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .focusRequester(focus)
                    .semantics { contentType = ContentType.PersonFullName },
            label = stringResource(if (current == null) R.string.certificates_name_label_new else R.string.certificates_name_label),
            placeholder = { Text(stringResource(R.string.certificates_name_placeholder)) },
            supportingText = {
                Text(
                    stringResource(
                        when {
                            isTooLong -> R.string.account_name_too_long
                            current == null -> R.string.certificates_name_hint_new
                            else -> R.string.certificates_name_hint
                        },
                    ),
                    Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                )
            },
            isError = isTooLong,
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
            if (current != null) {
                TextButton(onClick = model::stop, enabled = !model.isSaving) { Text(stringResource(R.string.certificates_cancel)) }
            }
            Button(busy = model.isSaving, onClick = save, enabled = name.isNotBlank() && !isTooLong) {
                Text(stringResource(R.string.certificates_save))
            }
        }
    }
}
