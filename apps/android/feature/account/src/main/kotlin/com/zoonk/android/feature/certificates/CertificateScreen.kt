package com.zoonk.android.feature.certificates

import androidx.annotation.DrawableRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.EmptyState
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.scaffold.DETAIL_PAGE_WIDTH
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.detailPagePadding
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.api.models.OwnedCertificate
import kotlinx.coroutines.launch

/**
 * Main's `/c/<code>` for its owner: the certificate with Share, Print, Download, Add to LinkedIn,
 * Copy link and its name. It reads the learner's list, so a rename shows here at once.
 */
@Composable
fun CertificateScreen(
    code: String,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val resource = app.certificates.certificates
    val state by resource.collectShown()
    val scope = rememberCoroutineScope()
    val wanted = normalizeCertificateCode(code)
    val certificate = state.value?.find { it.code == wanted }
    val actions = rememberCertificateActions(app)
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val isGuest = (session as? SessionState.SignedIn)?.isGuest == true
    val canShare = certificate?.recipientName != null && !isGuest

    PageScaffold(
        onBack = { navigator.back() },
        title = { Text(stringResource(R.string.certificates_certificate)) },
        actions = {
            if (certificate != null && canShare) {
                val fileName = certificate.fileName()
                val caption = certificate.caption()
                IconButton(onClick = { actions.share(certificate, fileName, caption) }, enabled = actions.busy == null) {
                    if (actions.busy == CertificateAction.Share) {
                        CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
                    } else {
                        Icon(painterResource(R.drawable.ic_share), contentDescription = stringResource(R.string.certificates_share))
                    }
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                certificate != null -> {
                    Certificate(app, certificate, actions, isGuest) { navigator.open(AppRoute.Login) }
                }

                state is LoadState.Failed -> {
                    LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } })
                }

                state is LoadState.Loaded || state == LoadState.Empty -> {
                    EmptyState(
                        icon = R.drawable.ic_workspace_premium,
                        title = stringResource(R.string.certificates_not_found),
                        description = stringResource(R.string.not_found_description),
                        modifier = Modifier.padding(detailPagePadding()),
                    )
                }

                else -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                }
            }
        }
    }
}

@Composable
private fun Certificate(
    app: AppContainer,
    certificate: OwnedCertificate,
    actions: CertificateActions,
    isGuest: Boolean,
    onCreateAccount: () -> Unit,
) {
    var renaming by rememberSaveable { mutableStateOf(false) }
    var linkedIn by rememberSaveable { mutableStateOf(false) }
    val recipient = certificate.recipientName
    val fileName = certificate.fileName()

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(detailPagePadding())
            .widthIn(max = DETAIL_PAGE_WIDTH),
    ) {
        Text(
            certificate.naming.words(),
            Modifier.pageTitle(),
            style = MaterialTheme.typography.titleLarge,
        )
        Text(
            certificate.kindLine(),
            Modifier.padding(top = 4.dp, bottom = 16.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        CertificatePicture(certificate.pictureUrl, app.images, certificate.pictureLabel(), Modifier.fillMaxWidth())

        when {
            isGuest -> {
                Column(Modifier.padding(top = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(stringResource(R.string.certificates_guest_line), style = MaterialTheme.typography.bodyLarge)
                    OutlinedButton(onClick = onCreateAccount) { Text(stringResource(R.string.certificates_create_account)) }
                }
            }

            // Share, print, download and LinkedIn wait for a name, as main's page does.
            recipient == null -> {
                CertificateNameField(app, current = null, onSaved = {}, modifier = Modifier.padding(top = 24.dp))
            }

            else -> {
                Column(Modifier.padding(top = 8.dp).bleed(LIST_ITEM_INSET)) {
                    ActionRow(
                        R.drawable.ic_print,
                        stringResource(R.string.certificates_print),
                        busy = actions.busy == CertificateAction.Print,
                        enabled = actions.busy == null,
                    ) {
                        actions.print(certificate, fileName)
                    }
                    ActionRow(
                        R.drawable.ic_download,
                        stringResource(R.string.certificates_download),
                        busy = actions.busy == CertificateAction.Download,
                        enabled = actions.busy == null,
                    ) {
                        actions.download(certificate, fileName)
                    }
                    ActionRow(R.drawable.ic_north_east, stringResource(R.string.certificates_add_to_linkedin)) { linkedIn = true }
                    ActionRow(
                        R.drawable.ic_link,
                        stringResource(R.string.certificates_copy_link),
                    ) { actions.copy(certificate.url.toString(), R.string.certificates_link_copied) }
                    HorizontalDivider(Modifier.padding(vertical = 8.dp))
                    if (renaming) {
                        CertificateNameField(
                            app = app,
                            current = recipient,
                            onSaved = { renaming = false },
                            modifier = Modifier.padding(horizontal = LIST_ITEM_INSET, vertical = 8.dp),
                            onCancel = { renaming = false },
                        )
                    } else {
                        ListItem(
                            headlineContent = { Text(stringResource(R.string.certificates_name_on_certificate)) },
                            modifier = Modifier.clickable(role = Role.Button) { renaming = true },
                            supportingContent = { Text(recipient) },
                            leadingContent = { Icon(painterResource(R.drawable.ic_edit), contentDescription = null) },
                            colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                        )
                    }
                }
            }
        }

        Text(
            stringResource(R.string.certificates_link_note),
            Modifier.padding(top = 16.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
    }

    if (linkedIn) LinkedInSheet(certificate, onCopy = actions::copy, onDismiss = { linkedIn = false })
}

@Composable
private fun ActionRow(
    @DrawableRes icon: Int,
    text: String,
    busy: Boolean = false,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    ListItem(
        headlineContent = { Text(text) },
        modifier = Modifier.clickable(enabled = enabled, role = Role.Button, onClick = onClick),
        leadingContent = {
            if (busy) {
                CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
            } else {
                Icon(painterResource(icon), contentDescription = null)
            }
        },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
    )
}
