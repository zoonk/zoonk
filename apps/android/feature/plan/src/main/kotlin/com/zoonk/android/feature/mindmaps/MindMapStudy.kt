package com.zoonk.android.feature.mindmaps

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.goalcontent.ChapterKey
import com.zoonk.android.feature.player.LessonTitle
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.steps.LessonMapView
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.TaskNotFound
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.DropdownMenu
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.components.MoreButton
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.OutlinedIconButton
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.TaskActionBar
import com.zoonk.android.ui.components.TaskActions
import com.zoonk.android.ui.components.taskColumn
import com.zoonk.android.ui.scaffold.BeforeFold
import com.zoonk.android.ui.scaffold.PageSpan
import com.zoonk.android.ui.scaffold.SpreadScreen
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.onPageSpan
import com.zoonk.android.ui.scaffold.pageFold
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.api.ApiJson
import com.zoonk.api.models.GoalMindMaps
import com.zoonk.api.models.LessonMindMap
import com.zoonk.api.models.SavedMindMapKind
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.util.UUID

/** A deck as it opened: frozen, so maps made or saved meanwhile don't move the learner's place. */
@Serializable
internal data class StudyOpening(
    val deck: List<DeckSlot>,
    val start: Int,
)

/**
 * Study: a goal's tab of maps one at a time, full screen. The deck opens at the tapped map, or where
 * this device stopped in this goal's tab, and keeps that place on the device as the learner moves.
 * It stays on the goal it opened with, whatever goal becomes active meanwhile.
 */
@Composable
fun MindMapStudyScreen(
    route: AppRoute.MindMapStudy,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val close: () -> Unit = { navigator.closeTask() }

    val goalId = remember(route.goalId) { runCatching { UUID.fromString(route.goalId) }.getOrNull() }

    val host = mindMapsHost(app)
    val tab = StudyTab.of(route.tab)
    if (host == null || tab == null || goalId == null) {
        TaskNotFound(navigator)
        return
    }
    val viewModel = host.maps(goalId)
    host.SavesSaid(viewModel)

    val store = host.store
    val list by store.list[goalId].collectShown()
    val handle =
        remember(host.session, goalId, tab) { app.drafts.open(host.session, studyPlaceKey(goalId, tab), MapPlace.serializer()) }
    var saved by rememberSaveable { mutableStateOf<String?>(null) }
    val opening = remember(saved) { saved?.let { ApiJson.decodeFromString(StudyOpening.serializer(), it) } }
    val maps = list.value
    val scope = rememberCoroutineScope()

    if (opening == null || maps == null) {
        if (opening == null && maps != null) {
            LaunchedEffect(Unit) {
                val place = MapPlace.of(route.start) ?: handle.value.first()
                val deck = maps.deck(tab)
                val start = place?.let { deck.indexOfPlace(it) } ?: 0
                saved = ApiJson.encodeToString(StudyOpening.serializer(), StudyOpening(deck, start))
            }
        }
        when (val state = list) {
            LoadState.Empty -> {
                TaskNotFound(navigator)
            }

            is LoadState.Failed -> {
                if (state.error == ApiError.NotFound) {
                    TaskNotFound(navigator)
                } else {
                    TaskScaffold(onClose = close) { padding ->
                        LoadFailedMessage(
                            onRetry = { scope.launch { store.list[goalId].refresh() } },
                            modifier = Modifier.padding(padding),
                        )
                    }
                }
            }

            else -> {
                TaskScaffold(onClose = close) { PageLoading(Modifier.padding(it), MaterialTheme.colorScheme.tertiary) }
            }
        }
        return
    }

    if (opening.deck.isEmpty()) {
        TaskNotFound(navigator)
        return
    }

    val saves by viewModel.saves.collectAsStateWithLifecycle()

    CompositionLocalProvider(LocalPrivatePictures provides host.pictures) {
        MindMapStudy(
            deck = opening.deck,
            start = opening.start,
            slide = { slot -> slideOf(slot, maps, goalId, app) },
            saves = saves,
            actions =
                StudyActions(
                    close = close,
                    save = viewModel::save,
                    navigate = navigator::open,
                    zoom = { chapterId -> navigator.open(AppRoute.MindMap(goalId.toString(), chapterId.toString())) },
                    settled = { slot -> scope.launch { handle.save(slot.place) } },
                ),
        )
    }
}

/** What a slide shows once its map is read, and its [title]: the map's, or its chapter's while the map can't show. */
internal sealed interface Slide {
    val title: String?

    data class Loading(
        override val title: String?,
    ) : Slide

    /** The deck counted it, but it no longer opens. */
    data class Gone(
        override val title: String?,
    ) : Slide

    data class Failed(
        override val title: String?,
        val retry: () -> Unit,
    ) : Slide

    data class Chapter(
        val chapterId: UUID,
        val map: ViewedMap,
        val saved: Boolean,
    ) : Slide {
        override val title: String get() = map.title
    }

    data class Lesson(
        val chapterId: UUID,
        val lesson: LessonMindMap,
    ) : Slide {
        override val title: String get() = lesson.title
    }
}

@Composable
private fun slideOf(
    slot: DeckSlot,
    maps: GoalMindMaps,
    goalId: UUID,
    app: AppContainer,
): Slide {
    val chapterId = UUID.fromString(slot.chapterId)
    val chapter = maps.chapters.firstOrNull { it.chapterId == chapterId }
    val lessonId =
        when (slot) {
            is DeckSlot.Chapter -> {
                val outline = chapter?.outline?.takeIf { chapter.opens } ?: return Slide.Gone(chapter?.title)
                return Slide.Chapter(chapterId, ViewedMap(chapter.title, chapter.image, outline), chapter.saved)
            }

            is DeckSlot.Lesson -> {
                slot.lessonId
            }
        }

    val resource = app.mindMaps.lessonMaps[ChapterKey(goalId, chapterId)]
    val read by resource.collectShown()
    val scope = rememberCoroutineScope()
    val lessons = read.value?.lessons
    val lesson = lessons?.firstOrNull { it.lessonId.toString() == lessonId }
    val chapterTitle = chapter?.title ?: read.value?.chapter?.title
    return when {
        lesson != null -> Slide.Lesson(chapterId, lesson)
        lessons != null -> Slide.Gone(chapterTitle)
        read is LoadState.Failed -> Slide.Failed(chapterTitle) { scope.launch { resource.refresh() } }
        read == LoadState.Empty -> Slide.Gone(chapterTitle)
        else -> Slide.Loading(chapterTitle)
    }
}

private val Slide.target: MindMapTarget?
    get() =
        when (this) {
            is Slide.Chapter -> MindMapTarget(SavedMindMapKind.CHAPTER, chapterId)
            is Slide.Lesson -> MindMapTarget(SavedMindMapKind.LESSON, lesson.lessonId)
            else -> null
        }

private val Slide.serverSaved: Boolean
    get() =
        when (this) {
            is Slide.Chapter -> saved
            is Slide.Lesson -> lesson.saved
            else -> false
        }

/** [zoom] opens a chapter's map full screen; [settled] is each map the learner stops on, to resume there. */
internal data class StudyActions(
    val close: () -> Unit,
    val save: (target: MindMapTarget, chapterId: UUID?, saved: Boolean) -> Unit,
    val navigate: (AppRoute) -> Unit,
    val zoom: (chapterId: UUID) -> Unit,
    val settled: (DeckSlot) -> Unit = {},
)

/**
 * The reader, in the lesson player's own bars: Close, the map's title, its bookmark and a menu above;
 * the map; then Previous (from the second map) and Next, Done on the last, below. Swipe, ← and →,
 * Enter, S to save and Esc move, save and close as main's keys do. Pages turn as a screen turns,
 * which the animator duration scale stills.
 */
@Composable
internal fun MindMapStudy(
    deck: List<DeckSlot>,
    start: Int,
    slide: @Composable (DeckSlot) -> Slide,
    saves: Map<MindMapTarget, Boolean>,
    actions: StudyActions,
) {
    val pager = rememberPagerState(initialPage = start.coerceIn(0, deck.lastIndex)) { deck.size }
    val scope = rememberCoroutineScope()
    val page = pager.currentPage
    val current = slide(deck[page])
    val target = current.target
    val saved = target?.let { saves[it] } ?: current.serverSaved
    val last = page == deck.lastIndex
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl

    val goTo = { index: Int -> scope.launch { pager.animateScrollToPage(index.coerceIn(0, deck.lastIndex)) } }
    val previous = { goTo(page - 1) }
    val next = {
        if (current.canAdvance) {
            if (last) actions.close() else goTo(page + 1)
        }
    }
    val toggleSave = { target?.let { actions.save(it, chapterOf(current), !saved) } }

    // Kept from map to map, so a learner who reads the text keeps reading it.
    var asText by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(pager) { snapshotFlow { pager.settledPage }.collect { actions.settled(deck[it]) } }

    SpreadScreen {
        TaskScaffold(
            onClose = actions.close,
            modifier =
                Modifier.onKeyEvent { event ->
                    if (event.type != KeyEventType.KeyDown || event.nativeKeyEvent.repeatCount > 0) return@onKeyEvent false
                    when (event.key) {
                        Key.DirectionLeft -> if (rtl) next() else previous()
                        Key.DirectionRight -> if (rtl) previous() else next()
                        Key.Enter, Key.NumPadEnter -> next()
                        Key.S -> toggleSave()
                        Key.Escape -> actions.close()
                        else -> return@onKeyEvent false
                    }
                    true
                },
            title = { current.title?.let { LessonTitle(it, Modifier.semantics { liveRegion = LiveRegionMode.Polite }) } },
            actions = {
                if (target != null) MapBookmark(saved, onToggle = { toggleSave() })
                StudyMenu(current, first = page == 0, onFirst = { goTo(0) }, actions.navigate)
            },
            bottomBar = {
                TaskActionBar {
                    TaskActions(
                        back = {
                            OutlinedIconButton(onClick = { previous() }, enabled = page > 0) {
                                Icon(
                                    painterResource(R.drawable.ic_chevron_left),
                                    contentDescription = stringResource(R.string.mindmaps_previous),
                                )
                            }
                        },
                    ) { main ->
                        Button(
                            onClick = { next() },
                            enabled = current.canAdvance,
                            modifier = main,
                        ) { Text(stringResource(if (last) R.string.mindmaps_done else R.string.mindmaps_next)) }
                    }
                }
            },
        ) { padding ->
            KeyFocus()
            HorizontalPager(
                state = pager,
                modifier = Modifier.fillMaxSize().padding(padding),
                beyondViewportPageCount = 1,
                key = { deck[it].key },
            ) { index ->
                SlideView(slide(deck[index]), asText, { asText = it }, actions.zoom)
            }
        }
    }
}

private fun chapterOf(slide: Slide): UUID? =
    when (slide) {
        is Slide.Chapter -> slide.chapterId
        is Slide.Lesson -> slide.chapterId
        else -> null
    }

@Composable
private fun StudyMenu(
    slide: Slide,
    first: Boolean,
    onFirst: () -> Unit,
    navigate: (AppRoute) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box {
        MoreButton(onClick = { open = true }, contentDescription = stringResource(R.string.mindmaps_options))
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text(stringResource(R.string.mindmaps_start_from_first)) },
                enabled = !first,
                onClick = {
                    open = false
                    onFirst()
                },
            )
            chapterOf(slide)?.let { chapterId ->
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.mindmaps_open_chapter)) },
                    onClick = {
                        open = false
                        navigate(AppRoute.Chapter(chapterId.toString()))
                    },
                )
            }
            if (slide is Slide.Lesson) {
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.mindmaps_open_lesson)) },
                    onClick = {
                        open = false
                        navigate(AppRoute.Lesson(slide.lesson.lessonId.toString()))
                    },
                )
            }
        }
    }
}

@Composable
private fun SlideView(
    slide: Slide,
    asText: Boolean,
    onAsText: (Boolean) -> Unit,
    zoom: (chapterId: UUID) -> Unit,
) {
    when (slide) {
        is Slide.Loading -> {
            PageLoading(color = MaterialTheme.colorScheme.tertiary)
        }

        is Slide.Gone -> {
            SlideMessage(stringResource(R.string.mindmaps_map_gone))
        }

        // Outlined, so Next stays the screen's one filled button.
        is Slide.Failed -> {
            SlideMessage(stringResource(R.string.mindmaps_unreachable)) {
                OutlinedButton(onClick = slide.retry) { Text(stringResource(R.string.mindmaps_try_again)) }
            }
        }

        is Slide.Chapter -> {
            ChapterSlide(slide.map, asText, onAsText) { zoom(slide.chapterId) }
        }

        is Slide.Lesson -> {
            LessonSlide(StepContent.Map(slide.lesson.map, slide.lesson.title))
        }
    }
}

/** A slide with only something to say, and maybe an [action] under it, in the middle of the page before an unfolded book's fold. */
@Composable
private fun SlideMessage(
    text: String,
    action: (@Composable () -> Unit)? = null,
) {
    BeforeFold(Modifier.fillMaxSize()) { beforeFold ->
        Column(
            beforeFold.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.bodyMedium,
            )
            action?.invoke()
        }
    }
}

/**
 * A chapter's map: its picture or its words, one at a time, as main's study screen, under a switch
 * that stays put. The picture is as large as its page holds it whole; the words read as one column.
 * On an unfolded book both keep to the page before the fold. Tapping the picture opens it to zoom,
 * over the deck, so back closes the zoom first.
 */
@Composable
private fun ChapterSlide(
    map: ViewedMap,
    asText: Boolean,
    onAsText: (Boolean) -> Unit,
    onZoom: () -> Unit,
) {
    var span by remember { mutableStateOf<PageSpan?>(null) }
    val image = map.image

    BoxWithConstraints(Modifier.fillMaxSize().onPageSpan { span = it }) {
        val fold = pageFold(maxWidth, span)
        val page = fold?.let { Modifier.width(it.start) } ?: Modifier.fillMaxWidth()

        if (image == null) {
            Column(page.fillMaxHeight().verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally) {
                Column(Modifier.taskColumn().padding(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(
                        stringResource(R.string.mindmaps_as_text_note),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    MindMapOutlineText(map.outline)
                }
            }
            return@BoxWithConstraints
        }

        Column(page.fillMaxHeight(), horizontalAlignment = Alignment.CenterHorizontally) {
            ShownAsSwitch(asText, onAsText, Modifier.padding(vertical = 8.dp))

            // A new view starts at its top.
            key(asText) {
                if (asText) {
                    Column(
                        Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        MindMapOutlineText(map.outline, Modifier.taskColumn().padding(vertical = 16.dp), titled = true)
                    }
                } else {
                    Column(
                        Modifier.fillMaxSize().padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(Modifier.weight(1f, fill = false)) { ZoomablePicture(map, image.url, onZoom) }
                        Text(
                            stringResource(R.string.mindmaps_zoom_hint),
                            Modifier.clearAndSetSemantics {},
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }
    }
}

/** Main's "Map / Text" switch: which of the two the map shows. */
@Composable
private fun ShownAsSwitch(
    asText: Boolean,
    onAsText: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val label = stringResource(R.string.mindmaps_shown_as)
    val choices = listOf(false to R.string.mindmaps_shown_map, true to R.string.mindmaps_shown_text)

    SingleChoiceSegmentedButtonRow(modifier.semantics { contentDescription = label }) {
        choices.forEachIndexed { index, (value, text) ->
            SegmentedButton(
                selected = asText == value,
                onClick = { onAsText(value) },
                shape = SegmentedButtonDefaults.itemShape(index, choices.size),
            ) { Text(stringResource(text)) }
        }
    }
}

@Composable
private fun ZoomablePicture(
    map: ViewedMap,
    url: String,
    onZoom: () -> Unit,
) {
    val shape = RoundedCornerShape(ZoonkRadius.lg)
    // The words aren't on screen beside the picture, so TalkBack reads them with it.
    val alt = mindMapDescription(map.outline, map.title)
    MapPicture(
        url = url,
        contentDescription = null,
        // A square as wide as it can be, unless the page's height stops it first.
        modifier =
            Modifier
                .aspectRatio(1f)
                .clip(shape)
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
                .clickable(onClickLabel = stringResource(R.string.mindmaps_zoom), onClick = onZoom)
                .semantics { contentDescription = alt },
        contentScale = ContentScale.Fit,
    )
}

/**
 * The player's map of a lesson's ideas, phone-wide and centered; on the page before an unfolded
 * book's fold, as the player's screen. A window that's only wide keeps it centered, its cards wide.
 */
@Composable
private fun LessonSlide(content: StepContent.Map) {
    var span by remember { mutableStateOf<PageSpan?>(null) }
    BoxWithConstraints(Modifier.fillMaxSize().onPageSpan { span = it }) {
        val fold = pageFold(maxWidth, span)
        Column(
            (fold?.let { Modifier.width(it.start) } ?: Modifier.fillMaxWidth()).fillMaxHeight().verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(Modifier.taskColumn().padding(vertical = 16.dp)) { LessonMapView(content) }
        }
    }
}

internal val Slide.canAdvance: Boolean get() = this is Slide.Chapter || this is Slide.Lesson
