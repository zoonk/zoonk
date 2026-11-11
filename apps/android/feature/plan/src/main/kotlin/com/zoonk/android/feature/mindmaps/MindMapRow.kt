package com.zoonk.android.feature.mindmaps

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.DropdownMenu
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.Limit
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionLabel
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.ChapterMindMap
import com.zoonk.api.models.FinishedChapter
import com.zoonk.api.models.GoalMindMap
import com.zoonk.api.models.MindMapImage
import java.util.UUID

/** Where a map's row shows, which sets its title, what it says once ready, and how it opens. */
enum class MindMapPlace {
    /** The chapter's page: titled "Mind map", with the wait spelled out. */
    Chapter,

    /** Where a lesson or a test that finished the chapter ends: titled with the chapter. */
    Finish,

    /** The Mind maps page: titled with the chapter over its number; a ready map opens from the whole row. */
    Library,
}

/** What a map's row reads, from the goal's list or the chapter's own read. */
internal data class MapFacts(
    val chapterId: UUID,
    val title: String,
    val position: Long,
    val status: MindMapShown,
    val lessonsToWrite: Long,
    val image: MindMapImage?,
)

internal val ChapterMindMap.facts get() = MapFacts(chapterId, title, position, status.shown, lessonsToWrite, image)

internal val GoalMindMap.facts get() = MapFacts(chapterId, title, position, status.shown, lessonsToWrite, image)

/**
 * [navigate] opens sign-up and Plus, [open] the ready map; [toggleSave] saves a ready map from the
 * row's long-press menu.
 */
internal data class MindMapRowActions(
    val create: () -> Unit,
    val navigate: (AppRoute) -> Unit,
    val open: () -> Unit,
    val toggleSave: (() -> Unit)? = null,
)

/** The chapter page's map row, under its header; nothing for a chapter that can't have a map. */
@Composable
fun ChapterMindMapRow(
    key: ChapterKey,
    app: AppContainer,
    navigate: (AppRoute) -> Unit,
    modifier: Modifier = Modifier,
) {
    val host = mindMapsHost(app) ?: return
    val read by app.mindMaps.chapter[key].collectShown()
    val map = read.value?.takeIf { it.status != ChapterMindMap.Status.UNAVAILABLE } ?: return

    ConnectedMindMapRow(map.facts, key.goalId, MindMapPlace.Chapter, host, navigate, modifier)
}

/** Whether [ChapterMindMapRow] shows a row, for a page that places the row by its layout. */
@Composable
fun chapterMindMapShown(
    key: ChapterKey,
    app: AppContainer,
): Boolean {
    if (mindMapsHost(app) == null) return false
    val read by app.mindMaps.chapter[key].collectShown()
    return read.value?.let { it.status != ChapterMindMap.Status.UNAVAILABLE } == true
}

/**
 * Main's finish moment, after the day's moment: "Chapter finished" over the finished chapter's map
 * row. The map is owed when the chapter's lessons are written, so it opens drawing; Continue never
 * waits for it.
 */
@Composable
fun FinishedChapterMoment(
    finished: FinishedChapter,
    app: AppContainer,
    navigate: (AppRoute) -> Unit,
    modifier: Modifier = Modifier,
) {
    val host = mindMapsHost(app) ?: return
    val read by app.mindMaps.chapter[ChapterKey(finished.goalId, finished.chapterId)].collectShown()
    val map = read.value?.takeIf { it.status != ChapterMindMap.Status.UNAVAILABLE } ?: return

    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        SectionLabel(stringResource(R.string.mindmaps_chapter_finished))
        ConnectedMindMapRow(
            map.facts.copy(title = finished.title),
            finished.goalId,
            MindMapPlace.Finish,
            host,
            navigate,
            Modifier.bleed(LIST_ITEM_INSET),
        )
    }
}

/** A row that makes, follows and opens its map with the screen's maps for [goalId]. */
@Composable
internal fun ConnectedMindMapRow(
    map: MapFacts,
    goalId: UUID,
    place: MindMapPlace,
    host: MindMapsHost,
    navigate: (AppRoute) -> Unit,
    modifier: Modifier = Modifier,
) {
    val maps = host.maps(goalId)
    val requests by maps.requests.collectAsStateWithLifecycle()
    val local = requests[map.chapterId]
    val shown = shownMindMap(map.status, local)

    FollowWhileOnItsWay(maps, map.chapterId, shown)

    CompositionLocalProvider(LocalPrivatePictures provides host.pictures) {
        MindMapRow(
            map = map,
            place = place,
            shown = shown,
            local = local,
            cap = if (shown == MindMapShown.Available) host.cap() else null,
            plus = host.plus(),
            actions =
                MindMapRowActions(
                    create = { maps.create(map.chapterId) },
                    navigate = navigate,
                    open = { navigate(AppRoute.MindMap(goalId.toString(), map.chapterId.toString())) },
                ),
            modifier = modifier,
        )
    }
}

/**
 * One map's row, the same on the chapter's page, where a chapter ends and on the Mind maps page:
 * its thumbnail once ready, otherwise a dashed slot with the map's mark, a spinner while it's on its
 * way or a lock while it's Plus-only; then what to do about it. A plan out of new maps ([cap]) or a
 * refused tap shows why under the row instead of Create; the Mind maps page says the cap once, above
 * its rows, and puts the chapter's number before its line where the row is [numbered].
 */
@Composable
internal fun MindMapRow(
    map: MapFacts,
    place: MindMapPlace,
    shown: MindMapShown,
    local: MindMapLocal?,
    cap: Limit?,
    plus: Boolean,
    actions: MindMapRowActions,
    modifier: Modifier = Modifier,
    saved: Boolean = false,
    numbered: Boolean = true,
) {
    val title = map.rowTitle(place, shown)
    val status = map.statusLine(place, shown, plus)
    val supporting = if (place == MindMapPlace.Library && numbered) factsLine(chapterNumber(map.position), status) else status
    val refused = local?.limit?.takeIf { shown == MindMapShown.Refused && !local.pending }
    val notice = refused ?: cap?.takeIf { place != MindMapPlace.Library }
    val library = place == MindMapPlace.Library
    val toggleSave = actions.toggleSave?.takeIf { shown == MindMapShown.Ready }
    var menu by remember { mutableStateOf(false) }
    val rowClick =
        when (shown) {
            MindMapShown.PlusRequired -> ({ actions.navigate(AppRoute.Subscription) })
            MindMapShown.Ready -> actions.open.takeIf { library }
            else -> null
        }

    Column(modifier) {
        Box {
            ListRow(
                headline = { Text(title) },
                modifier = if (place == MindMapPlace.Library) Modifier else Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                onClick = rowClick,
                onLongClickLabel = toggleSave?.let { stringResource(if (saved) R.string.mindmaps_unsave else R.string.mindmaps_save) },
                onLongClick = toggleSave?.let { { menu = true } },
                leading = { MapMark(map.image?.thumbnailUrl?.takeIf { shown == MindMapShown.Ready }, shown) },
                supporting = supporting?.let { { Text(it) } },
                meta =
                    when {
                        shown == MindMapShown.PlusRequired && !library -> ({ PlusMark() })
                        saved -> ({ SavedMark() })
                        else -> null
                    },
                trailing = rowAction(map, place, shown, local, cap, actions),
            )
            if (toggleSave != null) SaveMenu(menu, saved, onDismiss = { menu = false }, onToggle = toggleSave)
        }

        if (notice != null) {
            MindMapLimit(
                notice,
                local?.subject ?: LimitSubject.MindMaps,
                actions.navigate,
                Modifier.padding(start = LIST_ITEM_INSET + MARK_SIZE + MARK_GAP, end = LIST_ITEM_INSET, bottom = 12.dp),
            )
        }
    }
}

@Composable
private fun MapFacts.rowTitle(
    place: MindMapPlace,
    shown: MindMapShown,
): String =
    when {
        place != MindMapPlace.Chapter -> title
        shown == MindMapShown.WritingLessons -> stringResource(R.string.mindmaps_writing_lessons)
        shown == MindMapShown.Drawing -> stringResource(R.string.mindmaps_drawing)
        else -> stringResource(R.string.mindmaps_row_title)
    }

/**
 * What the row says about its map; the chapter's page spells out the wait under a title that names
 * it. The Mind maps page says once, in its intro, what writing a chapter's lessons first means.
 */
@Composable
private fun MapFacts.statusLine(
    place: MindMapPlace,
    shown: MindMapShown,
    plus: Boolean,
): String? {
    val library = place == MindMapPlace.Library
    val chapter = place == MindMapPlace.Chapter
    val described = if (library) null else stringResource(R.string.mindmaps_row_description)

    return when (shown) {
        MindMapShown.Available, MindMapShown.Refused -> {
            val toWrite =
                when {
                    library -> R.plurals.mindmaps_lessons_to_write
                    plus -> R.plurals.mindmaps_lessons_first_plus
                    else -> R.plurals.mindmaps_lessons_first_free
                }
            if (lessonsToWrite == 0L) {
                described
            } else {
                val count = lessonsToWrite.toInt()
                pluralStringResource(toWrite, count, formatNumber(count.toDouble(), currentLocale()))
            }
        }

        MindMapShown.WritingLessons -> {
            stringResource(if (chapter) R.string.mindmaps_writing_lessons_wait else R.string.mindmaps_writing_lessons)
        }

        MindMapShown.Drawing -> {
            stringResource(if (chapter) R.string.mindmaps_drawing_wait else R.string.mindmaps_drawing)
        }

        MindMapShown.Ready -> {
            when {
                image == null -> stringResource(if (library) R.string.mindmaps_as_text else R.string.mindmaps_as_text_note)
                place == MindMapPlace.Finish -> stringResource(R.string.mindmaps_ready)
                else -> described
            }
        }

        MindMapShown.Failed -> {
            stringResource(R.string.mindmaps_failed)
        }

        MindMapShown.Unreachable -> {
            stringResource(R.string.mindmaps_unreachable)
        }

        MindMapShown.PlusRequired -> {
            if (library) stringResource(R.string.subscription_plus) else described
        }

        MindMapShown.Unavailable -> {
            null
        }
    }
}

@Composable
private fun chapterNumber(position: Long) =
    stringResource(R.string.mindmaps_chapter_number, formatNumber(position.toDouble(), currentLocale()))

/**
 * The row's button: Create, Try again or Open; none while the map is on its way, while a cap or a
 * refusal stops it, or where the whole row opens it (a locked map, which opens Plus like the screen's
 * locked lessons, or a ready one on the Mind maps page). A refusal that only asks to wait keeps Create.
 */
private fun rowAction(
    map: MapFacts,
    place: MindMapPlace,
    shown: MindMapShown,
    local: MindMapLocal?,
    cap: Limit?,
    actions: MindMapRowActions,
): (@Composable () -> Unit)? {
    val slowedDown = shown == MindMapShown.Refused && local?.limit is Limit.SlowDown
    val pending = local?.pending == true

    return when {
        shown == MindMapShown.Ready && place != MindMapPlace.Library -> {
            { RowButton(R.string.mindmaps_open, R.string.mindmaps_open_spoken, map, place, onClick = actions.open) }
        }

        shown == MindMapShown.Failed || shown == MindMapShown.Unreachable -> {
            { RowButton(R.string.mindmaps_try_again, R.string.mindmaps_try_again_spoken, map, place, pending, actions.create) }
        }

        (shown == MindMapShown.Available && cap == null) || slowedDown -> {
            { RowButton(R.string.mindmaps_create, R.string.mindmaps_create_spoken, map, place, pending, actions.create) }
        }

        else -> {
            null
        }
    }
}

/** Main's small outline button at a row's end; away from the chapter's page TalkBack hears which chapter's map it acts on. */
@Composable
private fun RowButton(
    label: Int,
    spoken: Int?,
    map: MapFacts,
    place: MindMapPlace,
    busy: Boolean = false,
    onClick: () -> Unit,
) {
    val description = spoken?.takeIf { place != MindMapPlace.Chapter }?.let { stringResource(it, map.title) }
    OutlinedButton(
        onClick = onClick,
        modifier = if (description != null) Modifier.semantics { contentDescription = description } else Modifier,
        busy = busy,
        size = ButtonSize.Small,
    ) { Text(stringResource(label)) }
}

/** The map's thumbnail, or a dashed slot holding its mark, a spinner while it's on its way, or a lock while it's Plus-only. */
@Composable
internal fun MapMark(
    thumbnail: String?,
    shown: MindMapShown,
) {
    val shape = RoundedCornerShape(MARK_CORNER)
    if (thumbnail != null) {
        MapPicture(
            thumbnail,
            contentDescription = null,
            Modifier.size(MARK_SIZE).clip(shape).border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape),
        )
        return
    }

    val dash = MaterialTheme.colorScheme.outline
    Box(
        Modifier.size(MARK_SIZE).drawBehind {
            drawRoundRect(
                color = dash,
                cornerRadius = CornerRadius(MARK_CORNER.toPx()),
                style = Stroke(width = 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))),
            )
        },
        contentAlignment = Alignment.Center,
    ) {
        when {
            shown.onItsWay -> {
                CircularProgressIndicator(Modifier.size(16.dp), color = MaterialTheme.colorScheme.onSurfaceVariant, strokeWidth = 2.dp)
            }

            shown == MindMapShown.PlusRequired -> {
                Icon(
                    painterResource(R.drawable.ic_lock),
                    contentDescription = null,
                    Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            else -> {
                Icon(
                    painterResource(R.drawable.ic_lan),
                    contentDescription = null,
                    Modifier.size(16.dp),
                    tint = MaterialTheme.zoonk.kindMindMap,
                )
            }
        }
    }
}

private val MARK_SIZE = 48.dp
private val MARK_CORNER = ZoonkRadius.md

/** A list row's gap between its mark and its words, for the words under it to line up with. */
private val MARK_GAP = 12.dp

/** A saved map's bookmark at its row's end, in the words' color. */
@Composable
internal fun SavedMark() {
    Icon(
        painterResource(R.drawable.ic_bookmark_filled),
        contentDescription = stringResource(R.string.mindmaps_saved_state),
        Modifier.size(16.dp),
        tint = MaterialTheme.colorScheme.onSurface,
    )
}

/** A row's long-press menu: Save, or Remove from saved. */
@Composable
internal fun SaveMenu(
    expanded: Boolean,
    saved: Boolean,
    onDismiss: () -> Unit,
    onToggle: () -> Unit,
) {
    DropdownMenu(expanded = expanded, onDismissRequest = onDismiss) {
        DropdownMenuItem(
            text = { Text(stringResource(if (saved) R.string.mindmaps_unsave else R.string.mindmaps_save)) },
            leadingIcon = {
                Icon(
                    painterResource(if (saved) R.drawable.ic_bookmark_filled else R.drawable.ic_bookmark),
                    contentDescription = null,
                )
            },
            onClick = {
                onDismiss()
                onToggle()
            },
        )
    }
}
