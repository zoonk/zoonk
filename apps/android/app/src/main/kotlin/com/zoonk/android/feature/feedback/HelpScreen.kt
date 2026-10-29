package com.zoonk.android.feature.feedback

import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.scaffold.PageScaffold

/** Main's help page: a message to the team, then where else to find Zoonk. */
@Composable
fun HelpScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val context = LocalContext.current
    val socials = if (currentLocale().language == "pt") SOCIALS_PT else SOCIALS

    PageScaffold(onBack = { navigator.back() }, title = { Text(stringResource(R.string.account_menu_help)) }) { padding ->
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
                    text = stringResource(R.string.feedback_help_description),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )

                FeedbackForm(app, FeedbackTarget(screen = "support"))

                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SectionHeader(stringResource(R.string.feedback_follow_us))
                    OutlinedCard(Modifier.fillMaxWidth()) {
                        socials.forEachIndexed { index, (name, url) ->
                            if (index > 0) HorizontalDivider()
                            ListItem(
                                headlineContent = { Text(name) },
                                trailingContent = { Icon(painterResource(R.drawable.ic_open_in_new), contentDescription = null) },
                                modifier =
                                    Modifier.clickable(role = Role.Button) {
                                        CustomTabsIntent.Builder().build().launchUrl(context, url.toUri())
                                    },
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Main's `getSocialProfiles`: the networks its help page lists, with the Brazilian accounts in Portuguese. */
private val SOCIALS =
    listOf(
        "X" to "https://x.com/zoonkcom",
        "Instagram" to "https://www.instagram.com/zoonkcom",
        "LinkedIn" to "https://www.linkedin.com/company/zoonk",
        "YouTube" to "https://www.youtube.com/@zoonkcom",
        "Bluesky" to "https://bsky.app/profile/zoonk.bsky.social",
    )

private val SOCIALS_PT =
    listOf(
        "X" to "https://x.com/zoonkbr",
        "Instagram" to "https://www.instagram.com/zoonkbr",
        "LinkedIn" to "https://www.linkedin.com/company/zoonk",
        "YouTube" to "https://www.youtube.com/@zoonkbr",
        "Bluesky" to "https://bsky.app/profile/zoonkbr.bsky.social",
    )
