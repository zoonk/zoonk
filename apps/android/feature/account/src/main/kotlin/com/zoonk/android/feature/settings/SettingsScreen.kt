package com.zoonk.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
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
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SignOutResult
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.account.AccountAvatar
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.PageTitleRow
import com.zoonk.android.ui.components.TextButton
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
                        .padding(vertical = 16.dp),
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                PageTitleRow(stringResource(R.string.account_menu_settings), Modifier.padding(horizontal = LIST_ITEM_INSET))
                if (account != null) {
                    ListRow(
                        headline = {
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                AccountAvatar(account, size = 36.dp)
                                Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                                    Text(account.name.ifBlank { account.email }, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(
                                        account.email,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        style = MaterialTheme.typography.bodySmall,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                        },
                        modifier = Modifier.semantics { selected = navigator.currentRoute == AppRoute.Profile },
                        highlighted = navigator.currentRoute == AppRoute.Profile,
                        onClick = { open(AppRoute.Profile) },
                    )
                }

                Column {
                    PageRow(
                        title = stringResource(R.string.settings_preferences),
                        selected = navigator.currentRoute == AppRoute.Preferences,
                        summary = preferencesSummary(summary.value),
                    ) { open(AppRoute.Preferences) }
                    ListDivider()
                    PageRow(
                        title = stringResource(R.string.settings_memory),
                        selected = navigator.currentRoute == AppRoute.Memory,
                        count =
                            memory.value
                                ?.facts
                                ?.size
                                ?.let { formatNumber(it.toDouble(), currentLocale()) },
                    ) { open(AppRoute.Memory) }
                }

                Column {
                    PageRow(
                        title = stringResource(R.string.account_menu_subscription),
                        selected = navigator.currentRoute == AppRoute.Subscription,
                        mark =
                            if (account != null && summary.value?.tier == LearnerSummary.Tier.PLUS) {
                                { PlusMark(label = stringResource(R.string.subscription_plus)) }
                            } else {
                                null
                            },
                    ) { open(AppRoute.Subscription) }
                    ListDivider()
                    PageRow(
                        title = stringResource(R.string.account_menu_help),
                        selected = navigator.currentRoute == AppRoute.Help,
                    ) { open(AppRoute.Help) }
                    ListDivider()
                    PageRow(
                        title = stringResource(R.string.settings_licenses),
                        selected = navigator.currentRoute == AppRoute.Licenses,
                    ) { open(AppRoute.Licenses) }
                }

                if (account != null) {
                    ListRow(
                        headline = { Text(stringResource(R.string.account_menu_log_out), color = MaterialTheme.colorScheme.error) },
                        onClick = {
                            app.scope.launch {
                                when (app.sessions.signOut()) {
                                    SignOutResult.SignedOut -> navigator.closeSection()
                                    is SignOutResult.Failed -> app.snackbars.show(R.string.account_sign_out_failed)
                                }
                            }
                        },
                    )
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

/**
 * A settings page in the hub (main's `SettingsGroup` row): its name, and at its end a [summary] in
 * words, a [count] in mono figures or a [mark]. The page shown beside the hub is the highlighted row.
 */
@Composable
private fun PageRow(
    title: String,
    selected: Boolean,
    summary: String? = null,
    count: String? = null,
    mark: (@Composable () -> Unit)? = null,
    onClick: () -> Unit,
) {
    val words = MaterialTheme.typography.bodySmall
    ListRow(
        headline = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        modifier = Modifier.semantics { this.selected = selected },
        onClick = onClick,
        highlighted = selected,
        meta =
            when {
                mark != null -> mark
                count != null -> ({ Text(count) })
                summary != null -> ({ Text(summary, style = words, maxLines = 1, overflow = TextOverflow.Ellipsis) })
                else -> null
            },
    )
}

private val SETTINGS_PAGES =
    setOf(AppRoute.Profile, AppRoute.Preferences, AppRoute.Memory, AppRoute.Subscription, AppRoute.Help, AppRoute.Licenses)

/** Beside the hub, a page replaces the one shown, as main's settings tabs do, rather than stacking on it. */
fun AppNavigator.openSettingsPage(route: AppRoute) {
    if (currentRoute in SETTINGS_PAGES) back()
    open(route)
}
