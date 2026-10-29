package com.zoonk.android.feature.settings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ListItem
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.SessionState
import com.zoonk.android.feature.account.AccountFailure
import com.zoonk.android.feature.account.ProfileFields
import com.zoonk.android.feature.account.ProfileFormViewModel
import com.zoonk.android.feature.account.ProfileSaveFailure
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.scaffold.PageScaffold
import kotlinx.coroutines.launch

/** Main's profile page: name and username, the data download, and deleting the account. */
@Composable
fun ProfileScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val signedIn = session as? SessionState.SignedIn

    PageScaffold(onBack = { navigator.back() }, title = { Text(stringResource(R.string.settings_profile)) }) { padding ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .consumeWindowInsets(padding)
                    .imePadding()
                    .verticalScroll(rememberScrollState()),
            contentAlignment = Alignment.TopCenter,
        ) {
            Column(
                modifier =
                    Modifier
                        .widthIn(max = 640.dp)
                        .fillMaxWidth()
                        .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                Text(
                    text = stringResource(R.string.settings_profile_description),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )

                when {
                    signedIn == null -> {}

                    signedIn.isGuest -> {
                        Text(
                            text = stringResource(R.string.settings_profile_needs_account),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyLarge,
                        )
                        Button(onClick = { navigator.open(AppRoute.Login) }) { Text(stringResource(R.string.account_menu_create_account)) }
                    }

                    else -> {
                        Profile(app, navigator, signedIn)
                    }
                }
            }
        }
    }
}

@Composable
private fun Profile(
    app: AppContainer,
    navigator: AppNavigator,
    signedIn: SessionState.SignedIn,
) {
    val key = signedIn.session.localId
    val user = signedIn.account.user
    val form = viewModel(key = "profile-form:$key") { ProfileFormViewModel(app.account, user, createSavedStateHandle()) }
    val profile = viewModel(key = "profile:$key") { ProfileViewModel(app.account, signedIn.session, user.email) }
    val context = LocalContext.current
    val export =
        rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
            if (uri != null) profile.export { context.contentResolver.openOutputStream(uri) }
        }

    Section(stringResource(R.string.settings_account)) {
        OutlinedCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                ProfileFields(form)
                ProfileSaveFailure(form)
                if (form.isSaved) {
                    Text(
                        text = stringResource(R.string.settings_saved),
                        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                Button(onClick = form::save, enabled = form.canSave && form.isChanged, modifier = Modifier.align(Alignment.End)) {
                    Text(stringResource(R.string.settings_save))
                    if (form.isSaving) ButtonProgress()
                }
            }
        }
    }

    Section(stringResource(R.string.settings_your_data)) {
        OutlinedCard(Modifier.fillMaxWidth()) {
            ListItem(
                headlineContent = { Text(stringResource(R.string.settings_download_data)) },
                supportingContent = { Text(stringResource(R.string.settings_download_data_description)) },
            )
            OutlinedButton(
                onClick = { export.launch(EXPORT_FILE_NAME) },
                enabled = !profile.isExporting,
                modifier =
                    Modifier
                        .align(Alignment.End)
                        .padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
            ) {
                Text(stringResource(if (profile.isExporting) R.string.settings_download_preparing else R.string.settings_download))
                if (profile.isExporting) ButtonProgress()
            }
        }
        if (profile.exportFailed) Failure(stringResource(R.string.settings_download_failed))
    }

    Section(stringResource(R.string.settings_delete_account)) {
        OutlinedCard(Modifier.fillMaxWidth()) {
            ListItem(
                headlineContent = { Text(stringResource(R.string.settings_delete_my_account)) },
                supportingContent = { Text(stringResource(R.string.settings_delete_account_description)) },
            )
            OutlinedButton(
                onClick = profile::askToDelete,
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                modifier =
                    Modifier
                        .align(Alignment.End)
                        .padding(start = 16.dp, end = 16.dp, bottom = 16.dp),
            ) { Text(stringResource(R.string.settings_delete_ellipsis)) }
        }
    }

    DeletionDialogs(app, navigator, profile, signedIn)
}

@Composable
private fun DeletionDialogs(
    app: AppContainer,
    navigator: AppNavigator,
    profile: ProfileViewModel,
    signedIn: SessionState.SignedIn,
) {
    val email = signedIn.account.user.email
    val context = LocalContext.current
    val snackbars = LocalSnackbarHostState.current
    val deleted = stringResource(R.string.settings_account_deleted)
    val failure = profile.deletionFailure?.let { deletionFailureMessage(it) }

    when (profile.deletionStep) {
        DeletionStep.None -> {}

        DeletionStep.Confirm -> {
            AlertDialog(
                onDismissRequest = profile::dismissDeletion,
                title = { Text(stringResource(R.string.settings_delete_confirm_title)) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(stringResource(R.string.settings_delete_confirm_description))
                        failure?.let { Failure(it) }
                    }
                },
                confirmButton = { DeleteButton(R.string.settings_delete_my_account, profile.isDeleting, profile::delete) },
                dismissButton = {
                    TextButton(
                        onClick = profile::dismissDeletion,
                        enabled = !profile.isDeleting,
                    ) { Text(stringResource(R.string.settings_cancel)) }
                },
            )
        }

        DeletionStep.Code -> {
            val needsNewCode = profile.deletionFailure == AccountFailure.CodeExpired || profile.deletionFailure == AccountFailure.CodeLocked

            AlertDialog(
                onDismissRequest = profile::dismissDeletion,
                title = { Text(stringResource(R.string.settings_delete_code_title)) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(stringResource(R.string.settings_delete_code_description, email))
                        OutlinedTextField(
                            value = profile.code,
                            onValueChange = profile::onCodeChange,
                            modifier = Modifier.semantics { contentType = ContentType.SmsOtpCode },
                            label = { Text(stringResource(R.string.account_code_label)) },
                            enabled = !needsNewCode,
                            isError = failure != null,
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        )
                        failure?.let { Failure(it) }
                    }
                },
                confirmButton = {
                    if (needsNewCode) {
                        TextButton(onClick = profile::sendNewCode, enabled = !profile.isDeleting) {
                            Text(stringResource(R.string.account_send_new_code))
                        }
                    } else {
                        DeleteButton(R.string.settings_delete_verify, profile.isDeleting, profile::delete)
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = profile::dismissDeletion,
                        enabled = !profile.isDeleting,
                    ) { Text(stringResource(R.string.settings_cancel)) }
                },
            )
        }

        DeletionStep.AppleNote -> {
            AlertDialog(
                onDismissRequest = {},
                title = { Text(stringResource(R.string.settings_account_deleted_title)) },
                text = { Text(stringResource(R.string.settings_apple_not_revoked)) },
                confirmButton = { TextButton(onClick = profile::finish) { Text(stringResource(R.string.settings_done)) } },
                dismissButton = {
                    TextButton(onClick = { CustomTabsIntent.Builder().build().launchUrl(context, APPLE_ID_MANAGE_URL.toUri()) }) {
                        Text(stringResource(R.string.settings_manage_apple))
                    }
                },
            )
        }

        // Leaves first: forgetting the session would take this page away before it could.
        DeletionStep.Deleted -> {
            LaunchedEffect(Unit) {
                navigator.popToRoots()
                navigator.showRoot(AppTab.Today)
                app.scope.launch {
                    app.account.forgetDeletedAccount(signedIn.session)
                    snackbars.showSnackbar(deleted)
                }
            }
        }
    }
}

@Composable
private fun DeleteButton(
    text: Int,
    isDeleting: Boolean,
    onClick: () -> Unit,
) {
    TextButton(
        onClick = onClick,
        enabled = !isDeleting,
        colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
    ) {
        Text(stringResource(text))
        if (isDeleting) ButtonProgress()
    }
}

@Composable
private fun deletionFailureMessage(failure: AccountFailure): String =
    stringResource(
        when (failure) {
            AccountFailure.WrongCode -> R.string.account_failure_wrong_code
            AccountFailure.CodeExpired -> R.string.account_failure_code_expired
            AccountFailure.CodeLocked -> R.string.account_failure_code_locked
            AccountFailure.RateLimited -> R.string.account_failure_rate_limited
            AccountFailure.Network -> R.string.account_failure_network
            else -> R.string.settings_delete_failed
        },
    )

@Composable
private fun Section(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(title)
        content()
    }
}

@Composable
private fun Failure(message: String) {
    Text(
        text = message,
        modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
private fun ButtonProgress() {
    Spacer(Modifier.size(ButtonDefaults.IconSpacing))
    CircularProgressIndicator(modifier = Modifier.size(ButtonDefaults.IconSize), color = LocalContentColor.current, strokeWidth = 2.dp)
}

private const val EXPORT_FILE_NAME = "zoonk-data.json"
private const val APPLE_ID_MANAGE_URL = "https://account.apple.com/account/manage"
