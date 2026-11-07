package com.zoonk.android.feature.feedback

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.openWebPage
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.ui.components.PageHeader
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
                verticalArrangement = Arrangement.spacedBy(28.dp),
            ) {
                PageHeader(stringResource(R.string.account_menu_help), stringResource(R.string.feedback_help_description))

                FeedbackForm(app, viewModel { FeedbackViewModel(app.feedback, FeedbackTarget(screen = "support")) })

                // Main's row of quiet icons, each a 48dp target whose mark lines up with the page's margin.
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    SectionHeader(stringResource(R.string.feedback_follow_us))
                    FlowRow(Modifier.offset(x = -ICON_INSET)) {
                        socials.forEach { social ->
                            IconButton(onClick = { openWebPage(context, social.url) }) {
                                Icon(
                                    painterResource(social.icon),
                                    contentDescription = social.name,
                                    modifier = Modifier.size(18.dp),
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private data class Social(
    val name: String,
    @param:DrawableRes val icon: Int,
    val url: String,
)

/** Main's `getSocialProfiles`: the networks its help page lists, in its order, with the Brazilian accounts in Portuguese. */
private val SOCIALS =
    listOf(
        Social("X", R.drawable.ic_brand_x, "https://x.com/zoonkcom"),
        Social("LinkedIn", R.drawable.ic_brand_linkedin, "https://www.linkedin.com/company/zoonk"),
        Social("Instagram", R.drawable.ic_brand_instagram, "https://www.instagram.com/zoonkcom"),
        Social("Bluesky", R.drawable.ic_brand_bluesky, "https://bsky.app/profile/zoonk.bsky.social"),
        Social("YouTube", R.drawable.ic_brand_youtube, "https://www.youtube.com/@zoonkcom"),
    )

private val SOCIALS_PT =
    listOf(
        Social("X", R.drawable.ic_brand_x, "https://x.com/zoonkbr"),
        Social("LinkedIn", R.drawable.ic_brand_linkedin, "https://www.linkedin.com/company/zoonk"),
        Social("Instagram", R.drawable.ic_brand_instagram, "https://www.instagram.com/zoonkbr"),
        Social("Bluesky", R.drawable.ic_brand_bluesky, "https://bsky.app/profile/zoonkbr.bsky.social"),
        Social("YouTube", R.drawable.ic_brand_youtube, "https://www.youtube.com/@zoonkbr"),
    )

/** How far a 48dp target reaches past its 18dp mark on each side. */
private val ICON_INSET = 15.dp
