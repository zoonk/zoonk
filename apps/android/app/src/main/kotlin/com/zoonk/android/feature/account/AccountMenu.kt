package com.zoonk.android.feature.account

import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute

/**
 * The tab roots' account avatar (main's user menu). Until the account lane gives it the menu
 * (identity, Settings, Subscription, Help, Log out or Create an account), it opens the settings hub.
 */
@Composable
fun AccountMenu(
    app: AppContainer,
    navigator: AppNavigator,
) {
    IconButton(onClick = { navigator.open(AppRoute.Settings) }) {
        Icon(painterResource(R.drawable.ic_account_circle), contentDescription = stringResource(R.string.navigation_user_menu))
    }
}
