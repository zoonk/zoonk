package com.zoonk.android.feature.account

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.SignOutResult
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.LearnerSummary
import com.zoonk.api.models.MeUser
import kotlinx.coroutines.launch

/**
 * The tab roots' avatar, opening main's user menu. A guest is offered an account instead of
 * logging out, which would lose their plan.
 */
@Composable
fun AccountMenu(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val summary by app.learnerSummary.summary.collectShown()
    val signedIn = session as? SessionState.SignedIn
    val user = signedIn?.takeUnless { it.isGuest }?.account?.user
    val isPlus = summary.value?.tier == LearnerSummary.Tier.PLUS
    var isOpen by rememberSaveable { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val snackbars = LocalSnackbarHostState.current
    val signOutFailed = stringResource(R.string.account_sign_out_failed)

    fun go(route: AppRoute) {
        isOpen = false
        navigator.open(route)
    }

    Box {
        IconButton(onClick = { isOpen = true }) {
            Avatar(user)
        }

        DropdownMenu(expanded = isOpen, onDismissRequest = { isOpen = false }, modifier = Modifier.widthIn(min = 256.dp)) {
            if (user != null) {
                Identity(user)
                HorizontalDivider()
            }

            MenuItem(stringResource(R.string.account_menu_settings), R.drawable.ic_settings) { go(AppRoute.Settings) }

            if (user != null) {
                MenuItem(
                    text = stringResource(R.string.account_menu_subscription),
                    icon = R.drawable.ic_diamond,
                    trailing = if (isPlus) ({ PlusMark(label = stringResource(R.string.subscription_plus)) }) else null,
                ) { go(AppRoute.Subscription) }
            } else {
                MenuItem(stringResource(R.string.account_menu_pricing), R.drawable.ic_sell) { go(AppRoute.Subscription) }
            }

            MenuItem(stringResource(R.string.account_menu_help), R.drawable.ic_support) { go(AppRoute.Help) }
            HorizontalDivider()

            when {
                user != null -> {
                    MenuItem(stringResource(R.string.account_menu_log_out), R.drawable.ic_logout) {
                        isOpen = false
                        scope.launch {
                            if (app.sessions.signOut() is SignOutResult.Failed) snackbars.showSnackbar(signOutFailed)
                        }
                    }
                }

                signedIn != null -> {
                    MenuItem(stringResource(R.string.account_menu_create_account), R.drawable.ic_person_add) { go(AppRoute.Login) }
                    MenuItem(stringResource(R.string.gate_log_in), R.drawable.ic_login) { go(AppRoute.Login) }
                }

                else -> {
                    MenuItem(stringResource(R.string.gate_log_in), R.drawable.ic_login) { go(AppRoute.Login) }
                }
            }
        }
    }
}

@Composable
private fun Avatar(user: MeUser?) {
    val label = stringResource(R.string.navigation_user_menu)
    val image = user?.image

    if (image == null) {
        Icon(painterResource(R.drawable.ic_account_circle), contentDescription = label)
    } else {
        AsyncImage(
            model = image,
            contentDescription = label,
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(CircleShape),
            contentScale = ContentScale.Crop,
        )
    }
}

@Composable
private fun Identity(user: MeUser) {
    Row(
        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.widthIn(max = 280.dp)) {
            Text(
                text = user.name.ifBlank { user.email },
                style = MaterialTheme.typography.titleSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = user.email,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun MenuItem(
    text: String,
    @DrawableRes icon: Int,
    trailing: (@Composable () -> Unit)? = null,
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        text = { Text(text) },
        onClick = onClick,
        leadingIcon = { Icon(painterResource(icon), contentDescription = null) },
        trailingIcon = trailing,
    )
}
