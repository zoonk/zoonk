package com.zoonk.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.SessionState
import com.zoonk.android.feature.account.ProfileFields
import com.zoonk.android.feature.account.ProfileFormViewModel
import com.zoonk.android.feature.account.ProfileSaveFailure
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.PageTitleRow
import com.zoonk.android.ui.scaffold.PageScaffold
import kotlinx.coroutines.launch

/** Main's profile page: the name and the username. The data download and deleting the account are in Privacy. */
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
                        .padding(vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(28.dp),
            ) {
                PageTitleRow(stringResource(R.string.settings_profile), Modifier.padding(horizontal = LIST_ITEM_INSET))

                when {
                    signedIn == null -> {}

                    signedIn.isGuest -> {
                        Column(Modifier.padding(horizontal = LIST_ITEM_INSET), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            Text(
                                text = stringResource(R.string.settings_profile_needs_account),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyLarge,
                            )
                            Button(
                                onClick = { navigator.open(AppRoute.Login) },
                            ) { Text(stringResource(R.string.account_menu_create_account)) }
                        }
                    }

                    else -> {
                        Profile(app, signedIn)
                    }
                }
            }
        }
    }
}

@Composable
private fun Profile(
    app: AppContainer,
    signedIn: SessionState.SignedIn,
) {
    val form = viewModel(key = "profile-form:${signedIn.session.localId}") {
        ProfileFormViewModel(app.account, signedIn.account.user, createSavedStateHandle())
    }

    // A save's answer is a snackbar, so Save and the rows under it stay where they are.
    LaunchedEffect(form.isSaved) {
        if (form.isSaved) app.scope.launch { app.snackbars.show(R.string.settings_saved) }
    }

    Column(Modifier.padding(horizontal = LIST_ITEM_INSET), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ProfileFields(form)
        ProfileSaveFailure(form)
        Button(
            onClick = form::save,
            enabled = form.canSave && form.isChanged,
            busy = form.isSaving,
            modifier = Modifier.align(Alignment.End),
            leadingIcon = { ButtonIcon(R.drawable.ic_check) },
        ) {
            Text(stringResource(R.string.settings_save))
        }
    }
}
