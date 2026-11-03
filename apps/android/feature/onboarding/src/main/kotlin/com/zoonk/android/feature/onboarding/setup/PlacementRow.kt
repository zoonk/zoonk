package com.zoonk.android.feature.onboarding.setup

import androidx.activity.compose.LocalActivity
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.onVisibilityChanged
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.certificates.CertificatePicture
import com.zoonk.android.feature.certificates.languageWord
import com.zoonk.android.feature.certificates.naming
import com.zoonk.android.feature.certificates.pictureUrl
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.api.models.CertificateFacts
import kotlinx.coroutines.launch

/**
 * Main's placement row under the level test's bars: a quiet row rather than the award moment, since
 * the learner is still setting up. Its picture comes from the learner's list. Once it was on screen,
 * the learner leaving the screen counts as seeing the certificate.
 */
@Composable
internal fun PlacementRow(
    app: AppContainer,
    placement: CertificateFacts,
    isGuest: Boolean,
    navigator: AppNavigator,
) {
    val list by app.certificates.certificates.collectShown()
    val picture = list.value?.find { it.code == placement.code }?.pictureUrl
    val activity = LocalActivity.current
    val name = placement.naming
    var seen by rememberSaveable(placement.code) { mutableStateOf(false) }

    LaunchedEffect(placement.code) { app.certificates.awarded(listOf(placement.code)) }
    DisposableEffect(placement.code) {
        onDispose {
            if (seen && activity?.isChangingConfigurations != true) app.scope.launch { app.certificates.markShown(placement.code) }
        }
    }

    ListItem(
        headlineContent = { Text(stringResource(R.string.certificates_placement_row_title, name.languageWord(), name.level.orEmpty())) },
        modifier =
            Modifier
                .onVisibilityChanged { visible -> if (visible) seen = true }
                .clip(MaterialTheme.shapes.medium)
                .clickable(role = Role.Button) { navigator.open(AppRoute.Certificate(placement.code)) },
        supportingContent = {
            Text(stringResource(if (isGuest) R.string.certificates_placement_row_guest else R.string.certificates_placement_row_saved))
        },
        leadingContent = { CertificatePicture(picture, app.images, contentDescription = null, Modifier.width(84.dp), corner = 4.dp) },
        trailingContent = { Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = null) },
        colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
    )
}
