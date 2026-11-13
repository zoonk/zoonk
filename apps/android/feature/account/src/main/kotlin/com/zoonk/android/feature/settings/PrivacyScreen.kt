package com.zoonk.android.feature.settings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.app.openWebPage
import com.zoonk.android.data.LearningProfileStore
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.account.AccountFailure
import com.zoonk.android.feature.subscription.deletionPlusNotices
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.AlertDialog
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.DestructiveButton
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.PageTitleRow
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.scaffold.PageScaffold
import kotlinx.coroutines.launch

class PrivacyViewModel(
    private val profile: LearningProfileStore,
) : ViewModel() {
    /** The switch didn't save: it was put back. */
    var saveFailed by mutableStateOf(false)
        private set

    fun saveFailedShown() {
        saveFailed = false
    }

    fun setShareUsageData(share: Boolean) {
        saveFailed = false
        viewModelScope.launch { saveFailed = !profile.setShareUsageData(share) }
    }
}

/**
 * Main's Privacy page: sharing usage data for anyone with a profile, then, for an account, a copy of
 * its data and deleting it.
 */
@Composable
fun PrivacyScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val signedIn = (session as? SessionState.SignedIn)?.takeUnless { it.isGuest }
    val profile by app.learningProfile.profile.collectShown()
    val summary by app.learnerSummary.summary.collectShown()
    val privacy = viewModel { PrivacyViewModel(app.learningProfile) }
    val scope = rememberCoroutineScope()
    val snackbars = LocalSnackbarHostState.current
    val saveFailed = stringResource(R.string.settings_preferences_save_failed)

    LaunchedEffect(privacy.saveFailed) {
        if (privacy.saveFailed) {
            privacy.saveFailedShown()
            snackbars.showSnackbar(saveFailed)
        }
    }

    PageScaffold(onBack = { navigator.back() }, title = { Text(stringResource(R.string.settings_privacy)) }) { padding ->
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState()),
            contentAlignment = Alignment.TopCenter,
        ) {
            Column(
                modifier =
                    Modifier
                        .widthIn(max = 640.dp)
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(28.dp),
            ) {
                PageTitleRow(stringResource(R.string.settings_privacy), Modifier.padding(horizontal = LIST_ITEM_INSET))

                when (val state = profile) {
                    is LoadState.Loaded -> {
                        // The learner's own choice, or with none yet what the summary resolved for where they are.
                        SwitchRow(
                            title = stringResource(R.string.settings_preferences_share_usage_data),
                            description = stringResource(R.string.settings_preferences_share_usage_data_description),
                            checked = state.value.shareUsageData ?: (summary.value?.analytics?.usageDataSharing == true),
                            onCheckedChange = privacy::setShareUsageData,
                        )
                    }

                    is LoadState.Failed -> {
                        LoadFailedMessage(onRetry = { scope.launch { app.learningProfile.profile.refresh() } })
                    }

                    LoadState.Loading -> {
                        CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally))
                    }

                    LoadState.Idle, LoadState.Empty -> {}
                }

                signedIn?.let { YourData(app, navigator, it) }
            }
        }
    }
}

@Composable
private fun YourData(
    app: AppContainer,
    navigator: AppNavigator,
    signedIn: SessionState.SignedIn,
) {
    val data =
        viewModel(key = "your-data:${signedIn.session.localId}") {
            YourDataViewModel(app.account, signedIn.session, signedIn.account.user.email)
        }
    val context = LocalContext.current
    val export =
        rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
            if (uri != null) data.export { context.contentResolver.openOutputStream(uri) }
        }

    SettingsSection(stringResource(R.string.settings_your_data)) {
        ListRow(
            headline = { Text(stringResource(R.string.settings_download_data)) },
            trailing = {
                OutlinedButton(
                    onClick = { export.launch(EXPORT_FILE_NAME) },
                    busy = data.isExporting,
                    leadingIcon = { ButtonIcon(R.drawable.ic_download) },
                    size = ButtonSize.Small,
                ) {
                    Text(stringResource(R.string.settings_download))
                }
            },
        )
        if (data.exportFailed) Failure(stringResource(R.string.settings_download_failed), Modifier.padding(horizontal = LIST_ITEM_INSET))
        ListRow(
            headline = { Text(stringResource(R.string.settings_delete_my_account)) },
            trailing = {
                DestructiveButton(onClick = data::askToDelete, size = ButtonSize.Small) {
                    Text(stringResource(R.string.settings_delete_ellipsis))
                }
            },
        )
    }

    val account by app.subscriptions.account.collectShown()
    val provider =
        account.value
            ?.account
            ?.subscription
            ?.provider
    DeletionDialogs(app, navigator, data, signedIn, deletionPlusNotices(app.subscriptions.websiteSubscription, provider))
}

@Composable
private fun DeletionDialogs(
    app: AppContainer,
    navigator: AppNavigator,
    data: YourDataViewModel,
    signedIn: SessionState.SignedIn,
    plusNotices: List<String>,
) {
    val email = signedIn.account.user.email
    val context = LocalContext.current
    val failure = data.deletionFailure?.let { deletionFailureMessage(it) }

    when (data.deletionStep) {
        DeletionStep.None -> {}

        DeletionStep.Confirm -> {
            AlertDialog(
                onDismissRequest = data::dismissDeletion,
                title = { Text(stringResource(R.string.settings_delete_confirm_title)) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(stringResource(R.string.settings_delete_confirm_description))
                        plusNotices.forEach { Text(it) }
                        failure?.let { Failure(it) }
                    }
                },
                confirmButton = { DeleteButton(R.string.settings_delete_my_account, data.isDeleting, data::delete) },
                dismissButton = {
                    TextButton(
                        onClick = data::dismissDeletion,
                        enabled = !data.isDeleting,
                    ) { Text(stringResource(R.string.settings_cancel)) }
                },
            )
        }

        DeletionStep.Code -> {
            val needsNewCode = data.deletionFailure == AccountFailure.CodeExpired || data.deletionFailure == AccountFailure.CodeLocked

            AlertDialog(
                onDismissRequest = data::dismissDeletion,
                title = { Text(stringResource(R.string.settings_delete_code_title)) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(stringResource(R.string.settings_delete_code_description, email))
                        OutlinedTextField(
                            value = data.code,
                            onValueChange = data::onCodeChange,
                            modifier = Modifier.semantics { contentType = ContentType.SmsOtpCode },
                            label = stringResource(R.string.account_code_label),
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
                        TextButton(onClick = data::sendNewCode, enabled = !data.isDeleting) {
                            Text(stringResource(R.string.account_send_new_code))
                        }
                    } else {
                        DeleteButton(R.string.settings_delete_verify, data.isDeleting, data::delete)
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = data::dismissDeletion,
                        enabled = !data.isDeleting,
                    ) { Text(stringResource(R.string.settings_cancel)) }
                },
            )
        }

        DeletionStep.AppleNote -> {
            AlertDialog(
                onDismissRequest = {},
                title = { Text(stringResource(R.string.settings_account_deleted_title)) },
                text = { Text(stringResource(R.string.settings_apple_not_revoked)) },
                confirmButton = { TextButton(onClick = data::finish) { Text(stringResource(R.string.settings_done)) } },
                dismissButton = {
                    TextButton(onClick = { openWebPage(context, APPLE_ID_MANAGE_URL) }) {
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
                    app.snackbars.show(R.string.settings_account_deleted)
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
        busy = isDeleting,
        onClick = onClick,
        colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
    ) { Text(stringResource(text)) }
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
private fun Failure(
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

private const val EXPORT_FILE_NAME = "zoonk-data.json"
private const val APPLE_ID_MANAGE_URL = "https://account.apple.com/account/manage"
