package com.zoonk.android.feature.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SignOutResult
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.account.AccountAvatar
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.LearnerSummary
import kotlinx.coroutines.launch

/**
 * Main's settings hub: the account, then Preferences and Memory, then Subscription and Help, and
 * Log out. A guest is offered an account instead of logging out, which would lose their plan.
 */
@Composable
fun SettingsScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val summary by app.learnerSummary.summary.collectShown()
    val memory by app.memory.memory.collectShown()
    val signedIn = session as? SessionState.SignedIn
    val account = signedIn?.takeUnless { it.isGuest }?.account?.user
    val snackbars = LocalSnackbarHostState.current
    val signOutFailed = stringResource(R.string.account_sign_out_failed)
    val open = { route: AppRoute -> navigator.openSettingsPage(route) }

    PageScaffold(
        onBack = { navigator.back() },
        title = { Text(stringResource(R.string.account_menu_settings)) },
        actions = {
            when {
                signedIn == null -> {
                    TextButton(onClick = { navigator.open(AppRoute.Login) }) { Text(stringResource(R.string.gate_log_in)) }
                }

                signedIn.isGuest -> {
                    TextButton(
                        onClick = { navigator.open(AppRoute.Login) },
                    ) { Text(stringResource(R.string.account_menu_create_account)) }
                }
            }
        },
    ) { padding ->
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
                        .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                if (account != null) {
                    Group {
                        Row(
                            title = account.name.ifBlank { account.email },
                            supporting = account.email,
                            selected = navigator.currentRoute == AppRoute.Profile,
                            leading = { AccountAvatar(account, size = 40.dp) },
                        ) { open(AppRoute.Profile) }
                    }
                }

                Group {
                    Row(
                        title = stringResource(R.string.settings_preferences),
                        trailing = preferencesSummary(summary.value),
                        selected = navigator.currentRoute == AppRoute.Preferences,
                    ) { open(AppRoute.Preferences) }
                    HorizontalDivider()
                    Row(
                        title = stringResource(R.string.settings_memory),
                        trailing =
                            memory.value
                                ?.facts
                                ?.size
                                ?.let { formatNumber(it.toDouble(), currentLocale()) },
                        selected = navigator.currentRoute == AppRoute.Memory,
                    ) { open(AppRoute.Memory) }
                }

                Group {
                    Row(
                        title = stringResource(R.string.account_menu_subscription),
                        selected = navigator.currentRoute == AppRoute.Subscription,
                        trailingContent =
                            if (account != null && summary.value?.tier == LearnerSummary.Tier.PLUS) {
                                { PlusMark(label = stringResource(R.string.subscription_plus)) }
                            } else {
                                null
                            },
                    ) { open(AppRoute.Subscription) }
                    HorizontalDivider()
                    Row(
                        title = stringResource(R.string.account_menu_help),
                        selected = navigator.currentRoute == AppRoute.Help,
                    ) { open(AppRoute.Help) }
                }

                if (account != null) {
                    Group {
                        ListItem(
                            headlineContent = { Text(stringResource(R.string.account_menu_log_out)) },
                            colors = ListItemDefaults.colors(headlineColor = MaterialTheme.colorScheme.error),
                            modifier =
                                Modifier.clickable {
                                    app.scope.launch {
                                        when (app.sessions.signOut()) {
                                            SignOutResult.SignedOut -> navigator.closeSection()
                                            is SignOutResult.Failed -> snackbars.showSnackbar(signOutFailed)
                                        }
                                    }
                                },
                        )
                    }
                }
            }
        }
    }
}

/** The buddy's name and the app's language, as main's hub sums up Preferences. */
@Composable
private fun preferencesSummary(summary: LearnerSummary?): String {
    val locale = currentLocale()
    val language = locale.getDisplayLanguage(locale).replaceFirstChar { it.titlecase(locale) }
    val buddy = summary?.buddy?.name
    return if (buddy.isNullOrBlank()) language else stringResource(R.string.settings_preferences_summary, buddy, language)
}

@Composable
private fun Group(content: @Composable () -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth()) { content() }
}

@Composable
private fun Row(
    title: String,
    selected: Boolean,
    supporting: String? = null,
    trailing: String? = null,
    trailingContent: (@Composable () -> Unit)? = null,
    leading: (@Composable () -> Unit)? = null,
    onClick: () -> Unit,
) {
    ListItem(
        headlineContent = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        supportingContent = supporting?.let { { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
        leadingContent = leading,
        trailingContent = trailingContent ?: trailing?.let { { Text(it) } },
        colors =
            if (selected) {
                ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
            } else {
                ListItemDefaults.colors()
            },
        modifier =
            Modifier
                .semantics { this.selected = selected }
                .clickable(onClick = onClick),
    )
}

private val SETTINGS_PAGES = setOf(AppRoute.Profile, AppRoute.Preferences, AppRoute.Memory, AppRoute.Subscription, AppRoute.Help)

/** Beside the hub, a page replaces the one shown, as main's settings tabs do, rather than stacking on it. */
fun AppNavigator.openSettingsPage(route: AppRoute) {
    if (currentRoute in SETTINGS_PAGES) back()
    open(route)
}
