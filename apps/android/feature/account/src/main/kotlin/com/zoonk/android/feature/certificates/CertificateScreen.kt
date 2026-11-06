package com.zoonk.android.feature.certificates

import androidx.annotation.DrawableRes
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.EmptyState
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.DETAIL_PAGE_WIDTH
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.scaffold.detailPagePadding
import com.zoonk.android.ui.scaffold.pageTitle
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.OwnedCertificate
import kotlinx.coroutines.launch

/**
 * Main's `/c/<code>` for its owner: the certificate with Share, Print, Download, Add to LinkedIn,
 * Copy link and its name, or, earned without Plus, locked with the Plus notice. It reads the
 * learner's list, so a rename or a subscription shows here at once, and a locked one, which the
 * public read refuses, shows at all.
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
    val canShare = certificate?.recipientName != null && !certificate.locked

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
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .consumeWindowInsets(padding)
                .imePadding(),
        ) {
            when {
                certificate != null -> {
                    Certificate(app, certificate, actions) { navigator.open(AppRoute.Subscription) }
                }

                state is LoadState.Failed -> {
                    LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } })
                }

                state is LoadState.Loaded || state == LoadState.Empty -> {
                    BeforeFold { beforeFold ->
                        EmptyState(
                            icon = R.drawable.ic_workspace_premium,
                            title = stringResource(R.string.certificates_not_found),
                            description = stringResource(R.string.not_found_description),
                            modifier = beforeFold.padding(detailPagePadding()),
                        )
                    }
                }

                else -> {
                    PageLoading()
                }
            }
        }
    }
}

/**
 * The certificate and what the learner can do with it, which on an open book takes the page after
 * the fold.
 */
@Composable
private fun Certificate(
    app: AppContainer,
    certificate: OwnedCertificate,
    actions: CertificateActions,
    onSeePlus: () -> Unit,
) {
    // Above both layouts: folding moves what the learner does between the one column and the page after the fold, and each keeps its scroll.
    val name = certificateNameModel(app)
    var linkedIn by rememberSaveable { mutableStateOf(false) }
    val pageScroll = rememberScrollState()
    val usesScroll = rememberScrollState()
    val naming = certificate.naming
    val uses =
        @Composable {
            if (naming.locked) {
                CertificatesPlusNotice(onSeePlus, Modifier.padding(top = 24.dp))
            } else {
                Uses(certificate, actions, name) { linkedIn = true }
            }
        }

    PageWithSupportingPane(supportingPane = { DetailColumn(usesScroll) { uses() } }, panesTouch = true, atFoldOnly = true) { usesBeside ->
        DetailColumn(pageScroll) {
            // Main's certificate page: its name as a headline over a lead line.
            Text(
                naming.words(),
                Modifier.pageTitle(),
                style = MaterialTheme.typography.displaySmall,
            )
            Text(
                naming.kindLine(),
                Modifier.padding(top = 8.dp, bottom = 20.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.zoonkType.lead,
            )
            if (naming.locked) {
                LockedCertificate(naming, Modifier.fillMaxWidth())
            } else {
                CertificatePicture(certificate.pictureUrl, app.images, certificate.pictureLabel(), Modifier.fillMaxWidth())
            }
            if (!usesBeside) uses()
        }
    }

    if (linkedIn && !naming.locked) LinkedInSheet(certificate, onCopy = actions::copy, onDismiss = { linkedIn = false })
}

@Composable
private fun DetailColumn(
    scroll: ScrollState,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(scroll)
            .padding(detailPagePadding())
            .widthIn(max = DETAIL_PAGE_WIDTH),
        content = content,
    )
}

/** Print, download, LinkedIn, the link and the name, or the name first for a learner without one. */
@Composable
private fun Uses(
    certificate: OwnedCertificate,
    actions: CertificateActions,
    name: CertificateNameModel,
    onAddToLinkedIn: () -> Unit,
) {
    val recipient = certificate.recipientName
    val fileName = certificate.fileName()

    when {
        // Share, print, download and LinkedIn wait for a name, as main's page does.
        recipient == null -> {
            CertificateNameField(current = null, name, Modifier.padding(top = 24.dp))
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
                ActionRow(R.drawable.ic_north_east, stringResource(R.string.certificates_add_to_linkedin), onClick = onAddToLinkedIn)
                ActionRow(
                    R.drawable.ic_link,
                    stringResource(R.string.certificates_copy_link),
                ) { actions.copy(certificate.url.toString(), R.string.certificates_link_copied) }
                ListDivider(Modifier.padding(vertical = 8.dp))
                if (name.changing) {
                    CertificateNameField(recipient, name, Modifier.padding(horizontal = LIST_ITEM_INSET, vertical = 8.dp))
                } else {
                    ListRow(
                        headline = { Text(stringResource(R.string.certificates_name_on_certificate)) },
                        onClick = { name.change(recipient) },
                        supporting = { Text(recipient) },
                        leading = { Icon(painterResource(R.drawable.ic_edit), contentDescription = null) },
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

@Composable
private fun ActionRow(
    @DrawableRes icon: Int,
    text: String,
    busy: Boolean = false,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    ListRow(
        headline = { Text(text) },
        onClick = onClick,
        enabled = enabled,
        leading = {
            if (busy) {
                CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
            } else {
                Icon(painterResource(icon), contentDescription = null)
            }
        },
    )
}
