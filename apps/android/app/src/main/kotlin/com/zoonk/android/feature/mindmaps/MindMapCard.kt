package com.zoonk.android.feature.mindmaps

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.android.feature.plan.PendingLabel
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.android.ui.components.markSize
import com.zoonk.api.models.AllowanceItem
import com.zoonk.api.models.ChapterMindMap
import com.zoonk.api.models.MindMapImage
import java.util.UUID

/** The chapter page's mind map: nothing until the chapter is finished, then a tap makes it. */
@Composable
fun ChapterMindMapCard(
    mindMap: ChapterMindMap,
    key: ChapterKey,
    app: AppContainer,
    navigator: AppNavigator,
    modifier: Modifier = Modifier,
) {
    MindMapCard(mindMap, key, mindMapsHost(app) ?: return, navigator, modifier)
}

@Composable
internal fun MindMapCard(
    mindMap: ChapterMindMap,
    key: ChapterKey,
    host: MindMapsHost,
    navigator: AppNavigator,
    modifier: Modifier = Modifier,
) {
    val maps = host.maps(key.goalId)
    val requests by maps.requests.collectAsStateWithLifecycle()
    val local = requests[key.chapterId]
    val shown = shownMindMap(mindMap.status.shown, local)

    FollowWhileDrawn(maps, key.chapterId, shown, local)

    CompositionLocalProvider(LocalPrivatePictures provides host.pictures) {
        MindMapCardContent(
            mindMap = mindMap,
            shown = shown,
            local = local,
            cap = if (shown == MindMapShown.Ready) null else host.cap(),
            actions =
                MindMapCardActions(
                    create = { maps.create(key.chapterId) },
                    retry = { maps.retry(key.chapterId) },
                    fullScreen = { navigator.open(AppRoute.MindMap(key.chapterId.toString())) },
                    save = mindMap.image?.let { rememberSavePicture(maps, it, mindMap.title) },
                ),
            navigator = navigator,
            modifier = modifier,
        )
    }
}

/**
 * What a screen's mind maps need from the app: the store, the session it shows (for its pictures
 * and the polls), and the plan's cap on new maps, read only where a map could still be made.
 */
internal class MindMapsHost(
    val store: MindMapStore,
    val session: AuthenticatedSession,
    val pictures: PrivatePictures,
    val cap: @Composable () -> Limit?,
    private val currentSession: () -> AuthenticatedSession?,
) {
    @Composable
    fun maps(goalId: UUID): MindMapViewModel =
        viewModel(key = "mindmaps-$goalId-${session.localId}") { MindMapViewModel(store, session, goalId, currentSession) }
}

@Composable
internal fun mindMapsHost(app: AppContainer): MindMapsHost? {
    val session = app.sessions.current ?: return null
    return MindMapsHost(
        store = app.mindMaps,
        session = session,
        pictures = PrivatePictures(app.images, session),
        cap = {
            val allowance by app.subscriptions.allowance.collectShown()
            allowance.value?.reachedCap(AllowanceItem.Kind.MIND_MAP)
        },
        currentSession = { app.sessions.current },
    )
}

internal data class MindMapCardActions(
    val create: () -> Unit,
    val retry: () -> Unit,
    val fullScreen: () -> Unit,
    val save: (() -> Unit)?,
)

@Composable
internal fun MindMapCardContent(
    mindMap: ChapterMindMap,
    shown: MindMapShown,
    local: MindMapLocal?,
    cap: Limit?,
    actions: MindMapCardActions,
    navigator: AppNavigator,
    modifier: Modifier = Modifier,
) {
    val outline = mindMap.outline
    val image = mindMap.image

    when {
        shown == MindMapShown.Unavailable -> {}

        shown != MindMapShown.Ready || outline == null -> {
            MindMapRequest(shown, local, local?.limit ?: cap, actions, navigator, modifier)
        }

        image != null -> {
            MindMapPictureCard(mindMap, image, actions, modifier)
        }

        else -> {
            Column(modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(
                    stringResource(R.string.mindmaps_as_text_note),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
                MindMapOutlineText(outline)
            }
        }
    }
}

@Composable
private fun MindMapPictureCard(
    mindMap: ChapterMindMap,
    image: MindMapImage,
    actions: MindMapCardActions,
    modifier: Modifier,
) {
    OutlinedCard(modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        MapPicture(
            url = image.url,
            contentDescription = mindMapDescription(mindMap.outline, mindMap.title),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .clickable(onClickLabel = stringResource(R.string.mindmaps_full_screen), onClick = actions.fullScreen),
        )
        HorizontalDivider()
        Row(Modifier.padding(horizontal = 8.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            TextButton(onClick = actions.fullScreen, contentPadding = ButtonDefaults.TextButtonWithIconContentPadding) {
                Icon(painterResource(R.drawable.ic_open_in_full), contentDescription = null, Modifier.size(ButtonDefaults.IconSize))
                Text(stringResource(R.string.mindmaps_full_screen), Modifier.padding(start = ButtonDefaults.IconSpacing))
            }
            actions.save?.let { save ->
                TextButton(onClick = save, contentPadding = ButtonDefaults.TextButtonWithIconContentPadding) {
                    Icon(painterResource(R.drawable.ic_download), contentDescription = null, Modifier.size(ButtonDefaults.IconSize))
                    Text(stringResource(R.string.mindmaps_download), Modifier.padding(start = ButtonDefaults.IconSpacing))
                }
            }
        }
    }
}

@Composable
private fun MindMapRequest(
    shown: MindMapShown,
    local: MindMapLocal?,
    limit: Limit?,
    actions: MindMapCardActions,
    navigator: AppNavigator,
    modifier: Modifier,
) {
    val generating = shown == MindMapShown.Generating
    val failure = shown == MindMapShown.Failed || shown == MindMapShown.Unreachable
    val capped = limit != null && limit !is Limit.SlowDown
    val (title, description) =
        when (shown) {
            MindMapShown.Generating -> R.string.mindmaps_card_generating_title to R.string.mindmaps_card_generating
            MindMapShown.Failed -> R.string.mindmaps_card_title to R.string.mindmaps_card_failed
            MindMapShown.Unreachable -> R.string.mindmaps_card_title to R.string.mindmaps_card_unreachable
            else -> R.string.mindmaps_card_title to R.string.mindmaps_card_description
        }

    Column(modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(markSize()), contentAlignment = Alignment.Center) { KindDot(LearnKind.MindMap) }
            Column(
                modifier = Modifier.weight(1f).semantics { if (generating) liveRegion = LiveRegionMode.Polite },
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(stringResource(title), style = MaterialTheme.typography.titleSmall)
                Text(
                    stringResource(description),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }

        if (generating) {
            CircularProgressIndicator(
                Modifier.size(20.dp).align(Alignment.CenterHorizontally),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                strokeWidth = 2.dp,
            )
        } else {
            FilledTonalButton(
                onClick = if (failure) actions.retry else actions.create,
                enabled = local?.pending != true && !capped,
            ) {
                PendingLabel(
                    local?.pending == true,
                    stringResource(if (failure) R.string.mindmaps_try_again else R.string.mindmaps_card_create),
                )
            }
        }

        if (limit != null) MindMapLimit(limit, navigator)
    }
}
