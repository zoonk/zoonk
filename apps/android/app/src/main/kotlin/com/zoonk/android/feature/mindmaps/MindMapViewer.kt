package com.zoonk.android.feature.mindmaps

import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.PointerEventType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.toSize
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.android.feature.goalcontent.PageLoading
import com.zoonk.android.feature.goalcontent.WithPlanGoal
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.NotFoundMessage
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.api.models.MindMapImage
import com.zoonk.api.models.MindMapOutline
import java.util.UUID
import kotlin.math.exp

internal data class ViewedMap(
    val title: String,
    val image: MindMapImage,
    val outline: MindMapOutline?,
)

/**
 * A chapter's map full screen. Opened from the grid it reads the map the grid already has; opened
 * from anywhere else it reads the chapter's map.
 */
@Composable
fun MindMapScreen(
    route: AppRoute.MindMap,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val close: () -> Unit = { navigator.closeTask() }

    WithPlanGoal(app.learnerSummary.summary, navigator, frame = { TaskScaffold(onClose = close, content = it) }) { goal ->
        val host = mindMapsHost(app)
        val chapterId = runCatching { UUID.fromString(route.chapterId) }.getOrNull()
        if (host == null || chapterId == null) {
            TaskScaffold(onClose = close) { NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) }, Modifier.padding(it)) }
            return@WithPlanGoal
        }

        val listed by app.mindMaps.list[goal.id]
            .state
            .collectAsStateWithLifecycle()
        val fromList =
            listed.value
                ?.chapters
                ?.firstOrNull { it.chapterId == chapterId }
                ?.let { map -> map.image?.let { ViewedMap(map.title, it, map.outline) } }
        val viewed = fromList?.let(Viewed::Shown) ?: chapterMap(app, ChapterKey(goal.id, chapterId))

        when (viewed) {
            Viewed.Loading -> {
                TaskScaffold(onClose = close) { PageLoading(it) }
            }

            Viewed.Missing -> {
                TaskScaffold(onClose = close) { NotFoundMessage(onGoHome = { navigator.showRoot(AppTab.Today) }, Modifier.padding(it)) }
            }

            is Viewed.Shown -> {
                val maps = host.maps(goal.id)
                CompositionLocalProvider(LocalPrivatePictures provides host.pictures) {
                    MindMapViewer(viewed.map, onClose = close, onSave = rememberSavePicture(maps, viewed.map.image, viewed.map.title))
                }
            }
        }
    }
}

private sealed interface Viewed {
    data object Loading : Viewed

    /** The chapter has no picture to show. */
    data object Missing : Viewed

    data class Shown(
        val map: ViewedMap,
    ) : Viewed
}

@Composable
private fun chapterMap(
    app: AppContainer,
    key: ChapterKey,
): Viewed {
    val state by app.mindMaps.chapter[key].collectShown()
    val map = state.value
    return when {
        map != null -> map.image?.let { Viewed.Shown(ViewedMap(map.title, it, map.outline)) } ?: Viewed.Missing
        state is LoadState.Failed || state == LoadState.Empty -> Viewed.Missing
        else -> Viewed.Loading
    }
}

@Composable
internal fun MindMapViewer(
    map: ViewedMap,
    onClose: () -> Unit,
    onSave: () -> Unit,
) {
    var view by rememberSaveable(stateSaver = PAN_ZOOM_SAVER) { mutableStateOf(PanZoom.FIT) }
    var frame by remember { mutableStateOf(Size.Zero) }
    val outline = map.outline

    TaskScaffold(
        onClose = onClose,
        title = { Text(map.title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        actions = {
            IconButton(onClick = onSave) {
                Icon(painterResource(R.drawable.ic_download), contentDescription = stringResource(R.string.mindmaps_download))
            }
        },
    ) { padding ->
        BoxWithConstraints(Modifier.fillMaxSize().padding(padding)) {
            val outlineBeside = outline != null && maxWidth >= OUTLINE_BESIDE_FROM
            Row(Modifier.fillMaxSize()) {
                Column(Modifier.weight(1f).fillMaxHeight()) {
                    ZoomFrame(
                        map = map,
                        outlineShown = outlineBeside,
                        view = { view },
                        onView = { view = it },
                        frame = { frame },
                        onFrame = { frame = it },
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                    )
                    ZoomControls(
                        scale = view.scale,
                        onZoomOut = { view = view.zoomAt(frame, Offset.Zero, view.scale / PanZoom.ZOOM_STEP) },
                        onFit = { view = PanZoom.FIT },
                        onZoomIn = { view = view.zoomAt(frame, Offset.Zero, view.scale * PanZoom.ZOOM_STEP) },
                    )
                }

                if (outlineBeside) {
                    VerticalDivider()
                    MindMapOutlineText(
                        outline = outline,
                        modifier =
                            Modifier
                                .width(OUTLINE_WIDTH)
                                .fillMaxHeight()
                                .verticalScroll(rememberScrollState())
                                .padding(24.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun ZoomFrame(
    map: ViewedMap,
    outlineShown: Boolean,
    view: () -> PanZoom,
    onView: (PanZoom) -> Unit,
    frame: () -> Size,
    onFrame: (Size) -> Unit,
    modifier: Modifier = Modifier,
) {
    val picture = if (outlineShown) mindMapAlt(map.outline, map.title) else mindMapDescription(map.outline, map.title)
    val description = "$picture\n${stringResource(R.string.mindmaps_viewer_hint)}"
    val side = with(LocalDensity.current) { fitSide(frame()).toDp() }

    Box(
        modifier =
            modifier
                .clipToBounds()
                .onSizeChanged {
                    onFrame(it.toSize())
                    onView(view().clamped(it.toSize()))
                }.pointerInput(Unit) {
                    detectTransformGestures { centroid, pan, zoom, _ ->
                        val point = centroid - Offset(size.width / 2f, size.height / 2f)
                        val current = view()
                        onView(current.zoomAt(frame(), point, current.scale * zoom).panBy(frame(), pan))
                    }
                }.pointerInput(Unit) {
                    detectTapGestures(
                        onDoubleTap = { tap ->
                            val current = view()
                            val point = tap - Offset(size.width / 2f, size.height / 2f)
                            onView(if (current.scale > 1f) PanZoom.FIT else current.zoomAt(frame(), point, PanZoom.DOUBLE_TAP_SCALE))
                        },
                    )
                }.pointerInput(Unit) {
                    awaitPointerEventScope {
                        while (true) {
                            val event = awaitPointerEvent()
                            if (event.type != PointerEventType.Scroll) continue
                            val change = event.changes.first()
                            val point = change.position - Offset(size.width / 2f, size.height / 2f)
                            val current = view()
                            onView(current.zoomAt(frame(), point, current.scale * exp(-change.scrollDelta.y * WHEEL_ZOOM)))
                            change.consume()
                        }
                    }
                }.onKeyEvent { event ->
                    if (event.type != KeyEventType.KeyDown) return@onKeyEvent false
                    val current = view()
                    val bounds = frame()
                    val next =
                        when (event.key) {
                            Key.Plus, Key.Equals, Key.NumPadAdd -> current.zoomAt(bounds, Offset.Zero, current.scale * PanZoom.ZOOM_STEP)
                            Key.Minus, Key.NumPadSubtract -> current.zoomAt(bounds, Offset.Zero, current.scale / PanZoom.ZOOM_STEP)
                            Key.Zero, Key.NumPad0 -> PanZoom.FIT
                            Key.DirectionUp -> current.panBy(bounds, Offset(0f, ARROW_STEP))
                            Key.DirectionDown -> current.panBy(bounds, Offset(0f, -ARROW_STEP))
                            Key.DirectionLeft -> current.panBy(bounds, Offset(ARROW_STEP, 0f))
                            Key.DirectionRight -> current.panBy(bounds, Offset(-ARROW_STEP, 0f))
                            else -> null
                        }
                    next?.let(onView)
                    next != null
                }.focusable()
                .semantics {
                    contentDescription = description
                    role = Role.Image
                },
        contentAlignment = Alignment.Center,
    ) {
        if (side.value > 0f) {
            MapPicture(
                url = map.image.url,
                contentDescription = null,
                modifier =
                    Modifier.size(side).graphicsLayer {
                        val current = view()
                        scaleX = current.scale
                        scaleY = current.scale
                        translationX = current.x
                        translationY = current.y
                    },
                contentScale = ContentScale.Fit,
                original = true,
            )
        }
    }
}

@Composable
private fun ZoomControls(
    scale: Float,
    onZoomOut: () -> Unit,
    onFit: () -> Unit,
    onZoomIn: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        FilledTonalIconButton(onClick = onZoomOut, enabled = scale > 1f) {
            Icon(painterResource(R.drawable.ic_remove), contentDescription = stringResource(R.string.mindmaps_zoom_out))
        }
        val fit = stringResource(R.string.mindmaps_fit)
        FilledTonalButton(
            onClick = onFit,
            enabled = scale > 1f,
            modifier = Modifier.semantics { contentDescription = fit },
            contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
        ) {
            Icon(painterResource(R.drawable.ic_fit_screen), contentDescription = null, Modifier.size(ButtonDefaults.IconSize))
            Text(
                formatPercent(scale.toDouble(), currentLocale()),
                Modifier.padding(start = ButtonDefaults.IconSpacing),
                style = MaterialTheme.typography.labelLarge.copy(fontFeatureSettings = "tnum"),
            )
        }
        FilledTonalIconButton(onClick = onZoomIn, enabled = scale < PanZoom.MAX_SCALE) {
            Icon(painterResource(R.drawable.ic_add), contentDescription = stringResource(R.string.mindmaps_zoom_in))
        }
    }
}

private val PAN_ZOOM_SAVER =
    listSaver<PanZoom, Float>(
        save = { listOf(it.scale, it.x, it.y) },
        restore = { PanZoom(it[0], it[1], it[2]) },
    )

/** Main's aside from 72rem, as wide as the app's asides. */
private val OUTLINE_BESIDE_FROM = 840.dp
private val OUTLINE_WIDTH = 320.dp

/** A wheel notch zooms by about a fifth, as on main. */
private const val WHEEL_ZOOM = 0.2f
private const val ARROW_STEP = 80f
