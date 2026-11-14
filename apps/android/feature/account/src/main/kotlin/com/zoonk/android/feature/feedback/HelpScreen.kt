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
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.scaffold.PageScaffold

/** Main's help page: a message to the team, then where else to find Zoonk. */
@Composable
fun HelpScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val context = LocalContext.current
    val portuguese = currentLocale().language == "pt"

    val form = viewModel { FeedbackViewModel(app.feedback, FeedbackTarget(screen = "support")) }
    val accountEmail = accountEmail(app)

    PageScaffold(
        onBack = { navigator.back() },
        title = { Text(stringResource(R.string.account_menu_help)) },
        bottomBar = { TaskActions { main -> SendButton(form, accountEmail, main) } },
    ) { padding ->
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

                FeedbackForm(app, form, withSend = false)

                // Main's row of quiet icons, each a 48dp target whose mark lines up with the page's margin.
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    SectionHeader(stringResource(R.string.feedback_follow_us))
                    FlowRow(Modifier.offset(x = -ICON_INSET)) {
                        SOCIALS.forEach { social ->
                            IconButton(onClick = { openWebPage(context, if (portuguese) social.urlPt else social.url) }) {
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
    val urlPt: String = url,
)

/** Main's `getSocialProfiles`: where Zoonk posts, in its order, with the Brazilian profiles in Portuguese. */
private val SOCIALS =
    listOf(
        Social("X", R.drawable.ic_brand_x, "https://x.com/zoonkcom", "https://x.com/zoonkbr"),
        Social("LinkedIn", R.drawable.ic_brand_linkedin, "https://www.linkedin.com/company/zoonk"),
        Social("GitHub", R.drawable.ic_brand_github, "https://github.com/zoonk"),
        Social("Instagram", R.drawable.ic_brand_instagram, "https://www.instagram.com/zoonkcom", "https://www.instagram.com/zoonkbr"),
        Social("YouTube", R.drawable.ic_brand_youtube, "https://www.youtube.com/@zoonkcom", "https://www.youtube.com/@zoonkbr"),
        Social("Threads", R.drawable.ic_brand_threads, "https://www.threads.net/@zoonkcom", "https://www.threads.net/@zoonkbr"),
        Social("Reddit", R.drawable.ic_brand_reddit, "https://www.reddit.com/r/zoonk", "https://www.reddit.com/r/ZoonkBrasil"),
        Social("TikTok", R.drawable.ic_brand_tiktok, "https://www.tiktok.com/@zoonkcom", "https://www.tiktok.com/@zoonkbr"),
        Social("Facebook", R.drawable.ic_brand_facebook, "https://www.facebook.com/zoonkcom", "https://www.facebook.com/zoonkbr"),
    )

/** How far a 48dp target reaches past its 18dp mark on each side. */
private val ICON_INSET = 15.dp
