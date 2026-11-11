package com.zoonk.android.feature.mindmaps

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
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
import com.zoonk.android.feature.goalcontent.WithPlanGoal
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
import com.zoonk.android.ui.components.OutlinedIconButton
import com.zoonk.android.ui.components.PageLoading
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.taskColumn
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.PageSpan
import com.zoonk.android.ui.scaffold.SpreadScreen
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.scaffold.onPageSpan
import com.zoonk.android.ui.scaffold.pageFold
import com.zoonk.android.ui.scaffold.spreadFold
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.zoonkType
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

    WithPlanGoal(app.learnerSummary.summary, navigator, frame = { TaskScaffold(onClose = close, content = it) }) { _ ->
        val host = mindMapsHost(app)
        val tab = StudyTab.of(route.tab)
        if (host == null || tab == null || goalId == null) {
            TaskNotFound(navigator)
            return@WithPlanGoal
        }

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
            return@WithPlanGoal
        }

        if (opening.deck.isEmpty()) {
            TaskNotFound(navigator)
            return@WithPlanGoal
        }

        val viewModel = host.maps(goalId)
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
                        settled = { slot -> scope.launch { handle.save(slot.place) } },
                    ),
            )
        }
    }
}

private val LessonMindMap.opens: Boolean get() = !locked && map != null

/** What a slide shows once its map is read. */
internal sealed interface Slide {
    data object Loading : Slide

    /** The deck counted it, but it no longer opens. */
    data object Gone : Slide

    data class Failed(
        val retry: () -> Unit,
    ) : Slide

    data class Chapter(
        val chapterId: UUID,
        val position: Long,
        val map: ViewedMap,
        val saved: Boolean,
    ) : Slide

    data class Lesson(
        val chapterId: UUID,
        val chapterPosition: Long,
        val lesson: LessonMindMap,
    ) : Slide
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
                val outline = chapter?.outline?.takeIf { chapter.opens } ?: return Slide.Gone
                return Slide.Chapter(chapterId, chapter.position, ViewedMap(chapter.title, chapter.image, outline), chapter.saved)
            }

            is DeckSlot.Lesson -> {
                slot.lessonId
            }
        }

    val resource = app.mindMaps.lessonMaps[ChapterKey(goalId, chapterId)]
    val read by resource.collectShown()
    val scope = rememberCoroutineScope()
    val lessons = read.value?.lessons?.filter { it.opens }
    val lesson = lessons?.firstOrNull { it.lessonId.toString() == lessonId }
    return when {
        lesson != null -> Slide.Lesson(chapterId, chapter?.position ?: read.value?.chapter?.position ?: 0, lesson)
        lessons != null -> Slide.Gone
        read is LoadState.Failed -> Slide.Failed { scope.launch { resource.refresh() } }
        read == LoadState.Empty -> Slide.Gone
        else -> Slide.Loading
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

/** [settled] is each map the learner stops on, to resume there. */
internal data class StudyActions(
    val close: () -> Unit,
    val save: (target: MindMapTarget, chapterId: UUID?, saved: Boolean) -> Unit,
    val navigate: (AppRoute) -> Unit,
    val settled: (DeckSlot) -> Unit = {},
)

/**
 * The reader: Close, the map's title and where it is, and a menu above; the map; then Previous,
 * "5 of 12", Save and Next (Done on the last) below. Swipe, ← and →, S to save and Esc move, save
 * and close as main's keys do. Pages turn as a screen turns, which the animator duration scale stills.
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
    val next = { if (last) actions.close() else goTo(page + 1) }
    val toggleSave = { target?.let { actions.save(it, chapterOf(current), !saved) } }

    LaunchedEffect(pager) { snapshotFlow { pager.settledPage }.collect { actions.settled(deck[it]) } }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }

    SpreadScreen {
        TaskScaffold(
            onClose = actions.close,
            modifier =
                Modifier.onKeyEvent { event ->
                    if (event.type != KeyEventType.KeyDown || event.nativeKeyEvent.repeatCount > 0) return@onKeyEvent false
                    when (event.key) {
                        Key.DirectionLeft -> if (rtl) next() else previous()
                        Key.DirectionRight -> if (rtl) previous() else next()
                        Key.S -> toggleSave()
                        Key.Escape -> actions.close()
                        else -> return@onKeyEvent false
                    }
                    true
                },
            title = { StudyTitle(current) },
            actions = { StudyMenu(current, onFirst = { goTo(0) }, actions.navigate) },
            bottomBar = {
                StudyBar(
                    page = page,
                    count = deck.size,
                    saved = saved.takeIf { target != null },
                    onPrevious = { previous() },
                    onSave = { toggleSave() },
                    onNext = { next() },
                )
            },
        ) { padding ->
            // Keys reach the deck only from focus inside it; this takes that focus without a stop for TalkBack.
            Box(Modifier.focusRequester(focus).focusable().clearAndSetSemantics {})
            HorizontalPager(
                state = pager,
                modifier = Modifier.fillMaxSize().padding(padding),
                beyondViewportPageCount = 1,
                key = { deck[it].key },
            ) { index ->
                SlideView(slide(deck[index]), actions.navigate)
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
private fun StudyTitle(slide: Slide) {
    val locale = currentLocale()
    val (title, context) =
        when (slide) {
            is Slide.Chapter -> {
                slide.map.title to stringResource(R.string.mindmaps_chapter_number, formatNumber(slide.position.toDouble(), locale))
            }

            is Slide.Lesson -> {
                slide.lesson.title to
                    factsLine(
                        stringResource(R.string.mindmaps_chapter_number, formatNumber(slide.chapterPosition.toDouble(), locale)),
                        stringResource(R.string.mindmaps_lesson_number, formatNumber(slide.lesson.position.toDouble(), locale)),
                    )
            }

            else -> {
                return
            }
        }
    Column {
        Text(title, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(
            context,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun StudyMenu(
    slide: Slide,
    onFirst: () -> Unit,
    navigate: (AppRoute) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { open = true }) {
            Icon(painterResource(R.drawable.ic_more_vert), contentDescription = stringResource(R.string.mindmaps_options))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text(stringResource(R.string.mindmaps_start_from_first)) },
                onClick = {
                    open = false
                    onFirst()
                },
            )
            when (slide) {
                is Slide.Chapter -> {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.mindmaps_open_chapter)) },
                        onClick = {
                            open = false
                            navigate(AppRoute.Chapter(slide.chapterId.toString()))
                        },
                    )
                }

                is Slide.Lesson -> {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.mindmaps_open_lesson)) },
                        onClick = {
                            open = false
                            navigate(AppRoute.Lesson(slide.lesson.lessonId.toString()))
                        },
                    )
                }

                else -> {}
            }
        }
    }
}

/** Previous, where the learner is, Save (when the map can be saved) and Next, which ends as Done. */
@Composable
private fun StudyBar(
    page: Int,
    count: Int,
    saved: Boolean?,
    onPrevious: () -> Unit,
    onSave: () -> Unit,
    onNext: () -> Unit,
) {
    val locale = currentLocale()
    val last = page == count - 1

    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedIconButton(onClick = onPrevious, enabled = page > 0) {
            Icon(painterResource(R.drawable.ic_chevron_left), contentDescription = stringResource(R.string.mindmaps_previous))
        }
        Text(
            stringResource(R.string.mindmaps_position, formatNumber((page + 1).toDouble(), locale), formatNumber(count.toDouble(), locale)),
            Modifier.weight(1f),
            maxLines = 1,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.zoonkType.data,
        )
        if (saved != null) {
            TextButton(
                onClick = onSave,
                leadingIcon = { ButtonIcon(if (saved) R.drawable.ic_bookmark_filled else R.drawable.ic_bookmark) },
            ) { Text(stringResource(if (saved) R.string.mindmaps_saved_state else R.string.mindmaps_save)) }
        }
        Button(
            onClick = onNext,
            trailingIcon = if (last) null else ({ ButtonIcon(R.drawable.ic_arrow_forward) }),
        ) { Text(stringResource(if (last) R.string.mindmaps_done else R.string.mindmaps_next)) }
    }
}

@Composable
private fun SlideView(
    slide: Slide,
    navigate: (AppRoute) -> Unit,
) {
    when (slide) {
        Slide.Loading -> {
            PageLoading(color = MaterialTheme.colorScheme.tertiary)
        }

        Slide.Gone -> {
            Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                Text(
                    stringResource(R.string.mindmaps_map_gone),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }

        is Slide.Failed -> {
            LoadFailedMessage(onRetry = slide.retry)
        }

        is Slide.Chapter -> {
            ChapterSlide(slide.map) { navigate(AppRoute.MindMap(slide.chapterId.toString())) }
        }

        is Slide.Lesson -> {
            slide.lesson.map?.let { LessonSlide(StepContent.Map(it, slide.lesson.title)) }
        }
    }
}

/**
 * A chapter's map: its picture, then its words, in one scroll on a phone; side by side where the
 * screen shows two pages (a book's fold, or a window 840dp and wider). Tapping the picture opens it
 * to zoom, over the deck, so back closes the zoom first.
 */
@Composable
private fun ChapterSlide(
    map: ViewedMap,
    onZoom: () -> Unit,
) {
    var span by remember { mutableStateOf<PageSpan?>(null) }
    val image = map.image

    BoxWithConstraints(Modifier.fillMaxSize().onPageSpan { span = it }) {
        val fold = spreadFold(maxWidth, span)

        when {
            image == null -> {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally) {
                    Column(Modifier.taskColumn().padding(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Text(
                            stringResource(R.string.mindmaps_as_text_note),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        MindMapOutlineText(map.outline)
                    }
                }
            }

            fold != null -> {
                Box(Modifier.width(fold.start).fillMaxHeight().padding(16.dp), contentAlignment = Alignment.Center) {
                    ZoomablePicture(map, image.url, onZoom)
                }
                Column(
                    Modifier
                        .fillMaxSize()
                        .padding(start = fold.end)
                        .verticalScroll(rememberScrollState())
                        .padding(24.dp),
                ) {
                    MindMapOutlineText(map.outline)
                }
            }

            else -> {
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()), horizontalAlignment = Alignment.CenterHorizontally) {
                    Column(Modifier.taskColumn().padding(vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(24.dp)) {
                        ZoomablePicture(map, image.url, onZoom)
                        MindMapOutlineText(map.outline)
                    }
                }
            }
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
    val alt = mindMapAlt(map.outline, map.title)
    MapPicture(
        url = url,
        contentDescription = null,
        modifier =
            Modifier
                .fillMaxWidth()
                .aspectRatio(1f)
                .clip(shape)
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
                .clickable(onClickLabel = stringResource(R.string.mindmaps_zoom), onClick = onZoom)
                .semantics { contentDescription = alt },
        contentScale = ContentScale.Fit,
    )
}

/** The player's map of a lesson's ideas, phone-wide, before the fold on a book. */
@Composable
private fun LessonSlide(content: StepContent.Map) {
    var span by remember { mutableStateOf<PageSpan?>(null) }
    BoxWithConstraints(Modifier.fillMaxSize().onPageSpan { span = it }) {
        val fold = pageFold(maxWidth, span)
        Column(
            (
                if (fold !=
                    null
                ) {
                    Modifier.width(fold.start)
                } else {
                    Modifier.fillMaxWidth()
                }
            ).fillMaxHeight().verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(Modifier.taskColumn().padding(vertical = 16.dp)) { LessonMapView(content) }
        }
    }
}
