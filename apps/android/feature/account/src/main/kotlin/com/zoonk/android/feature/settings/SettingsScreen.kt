package com.zoonk.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
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
import com.zoonk.android.feature.reminders.reminderTime
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.PageTitleRow
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.StudyReminder
import kotlinx.coroutines.launch

/**
 * Main's settings hub: the account, then Preferences, Reminders, About you, Memory and Privacy, then Subscription and Help, and
 * Log out. A guest is offered an account instead of logging out, which would lose their plan.
 */
@Composable
fun SettingsScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val learner by app.learnerSummary.summary.collectShown()
    val reminder by app.reminders.reminder.collectShown()
    val signedIn = session as? SessionState.SignedIn
    val account = signedIn?.takeUnless { it.isGuest }?.account?.user
    val open = { route: AppRoute -> navigator.openSettingsPage(route) }

    PageScaffold(
        onBack = { navigator.back() },
        title = { Text(stringResource(R.string.account_menu_settings)) },
        columnWidth = SETTINGS_COLUMN_WIDTH,
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
                    Modifier.settingsColumn(),
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

                val current = navigator.currentRoute
                PageGroup(
                    listOf(
                        SettingsPage(stringResource(R.string.settings_preferences), AppRoute.Preferences, current),
                        SettingsPage(
                            stringResource(R.string.reminders_title),
                            AppRoute.Reminders,
                            current,
                            summary = reminder.value?.let { remindersSummary(it) },
                        ),
                        SettingsPage(
                            stringResource(R.string.profile_questions_title),
                            AppRoute.AboutYou,
                            current,
                            selected = current == AppRoute.AboutYou || current is AppRoute.ProfileQuestionEdit,
                        ),
                        SettingsPage(stringResource(R.string.settings_memory), AppRoute.Memory, current),
                        SettingsPage(stringResource(R.string.settings_privacy), AppRoute.PrivacySettings, current),
                    ),
                    open,
                )

                PageGroup(
                    listOf(
                        SettingsPage(
                            stringResource(R.string.account_menu_subscription),
                            AppRoute.Subscription,
                            current,
                            summary =
                                stringResource(R.string.subscription_plus).takeIf {
                                    account != null && learner.value?.tier == LearnerSummary.Tier.PLUS
                                },
                        ),
                        SettingsPage(stringResource(R.string.account_menu_help), AppRoute.Help, current),
                        SettingsPage(stringResource(R.string.settings_licenses), AppRoute.Licenses, current),
                    ),
                    open,
                )

                if (account != null) {
                    ListRow(
                        headline = { Text(stringResource(R.string.account_menu_log_out)) },
                        onClick = {
                            app.scope.launch {
                                when (app.sessions.signOut()) {
                                    SignOutResult.SignedOut -> navigator.closeSection()
                                    is SignOutResult.Failed -> app.snackbars.show(R.string.account_sign_out_failed)
                                }
                            }
                        },
                        chevron = false,
                    )
                }
            }
        }
    }
}

/** The time reminders go out, or that none are on. */
@Composable
private fun remindersSummary(reminder: StudyReminder): String =
    if (reminder.email.on || reminder.push.on) reminderTime(reminder.time) else stringResource(R.string.settings_reminders_off)

/** A page in the hub, [selected] while it's the one shown beside the hub. */
private class SettingsPage(
    val title: String,
    val route: AppRoute,
    current: AppRoute,
    val summary: String? = null,
    val selected: Boolean = current == route,
)

/** Main's `SettingsGroup`: its pages with hairlines between them, gone beside the page shown. */
@Composable
private fun PageGroup(
    pages: List<SettingsPage>,
    onOpen: (AppRoute) -> Unit,
) {
    Column {
        pages.forEachIndexed { index, page ->
            if (index > 0) ListDivider(besideHighlight = page.selected || pages[index - 1].selected)
            PageRow(page.title, page.selected, page.summary) { onOpen(page.route) }
        }
    }
}

/**
 * A settings page in the hub (main's `SettingsGroup` row): its name, and at its end a [summary] in
 * words. The page shown beside the hub is the highlighted row.
 */
@Composable
private fun PageRow(
    title: String,
    selected: Boolean,
    summary: String? = null,
    onClick: () -> Unit,
) {
    val words = MaterialTheme.typography.bodySmall
    ListRow(
        headline = { Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        modifier = Modifier.semantics { this.selected = selected },
        onClick = onClick,
        highlighted = selected,
        meta =
            summary?.let { { Text(it, style = words, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
    )
}

private val SETTINGS_PAGES =
    setOf(
        AppRoute.Profile,
        AppRoute.Preferences,
        AppRoute.Reminders,
        AppRoute.AboutYou,
        AppRoute.Memory,
        AppRoute.PrivacySettings,
        AppRoute.Subscription,
        AppRoute.Help,
        AppRoute.Licenses,
    )

/** Beside the hub, a page replaces the one shown, as main's settings tabs do, rather than stacking on it. */
fun AppNavigator.openSettingsPage(route: AppRoute) {
    if (currentRoute is AppRoute.ProfileQuestionEdit) back()
    if (currentRoute in SETTINGS_PAGES) back()
    open(route)
}
