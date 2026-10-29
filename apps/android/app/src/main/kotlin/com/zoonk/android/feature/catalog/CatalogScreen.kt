package com.zoonk.android.feature.catalog

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyGridState
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfoV2
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.window.core.layout.WindowSizeClass
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.EmptyState
import com.zoonk.android.ui.components.GoalBox
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.Subject
import com.zoonk.android.ui.components.SubjectGlyph
import com.zoonk.android.ui.components.SubjectLabel
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.CourseCategoryCounts
import com.zoonk.api.models.CourseResult
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch
import java.text.BreakIterator
import java.text.Collator
import java.util.Locale

/**
 * Main's `/courses`: the goal box, the categories and every course, a page at a time. A category
 * is the list's filter here, not a page of its own, so trying several never stacks up pages.
 */
@Composable
fun CatalogScreen(
    route: AppRoute.Catalog,
    app: AppContainer,
    navigator: AppNavigator,
    catalog: CatalogStore = app.catalog,
) {
    val locale = currentLocale()
    val language = catalogLanguage(locale)
    var category by rememberSaveable { mutableStateOf(route.category?.takeIf { Subject.of(it).label != null }) }
    val list = CourseList(language, category)
    val courses = catalog.courses[list]
    val counts = catalog.categoryCounts[language]
    val state by courses.collectShown()
    val countsState by counts.collectShown()
    val isRefreshing by courses.isRefreshing.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val wide = currentWindowAdaptiveInfoV2().windowSizeClass.isWidthAtLeastBreakpoint(WindowSizeClass.WIDTH_DP_EXPANDED_LOWER_BOUND)
    val categories = categoryLinks(countsState.value, category, locale)
    val gridState = rememberSaveable(category, saver = LazyGridState.Saver) { LazyGridState() }
    val title = category?.let { stringResource(R.string.catalog_category_title, stringResource(Subject.of(it).label!!)) }

    PageScaffold(
        onBack = { navigator.back() },
        title = { Text(title ?: stringResource(R.string.catalog_title), maxLines = 1, overflow = TextOverflow.Ellipsis) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                scope.launch { courses.refresh() }
                scope.launch { counts.refresh() }
            },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            Row(Modifier.fillMaxSize()) {
                if (wide) {
                    CategoryList(categories, onSelect = { category = it }, Modifier.width(240.dp).verticalScroll(rememberScrollState()))
                }

                CourseGrid(
                    app = app,
                    catalog = catalog,
                    navigator = navigator,
                    list = list,
                    state = state,
                    gridState = gridState,
                    header = {
                        CatalogHeader(
                            categories = categories.takeUnless { wide },
                            onSelect = { category = it },
                            onGoal = { goal -> navigator.open(AppRoute.StartGoal(goal = goal)) },
                        )
                    },
                    onRetry = { scope.launch { courses.refresh() } },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

internal data class CategoryLink(
    val key: String?,
    val label: String,
    val count: Long,
    val selected: Boolean,
)

/** Main lists a category only while it has courses, and the one being shown even when empty, by name. */
@Composable
private fun categoryLinks(
    counts: CourseCategoryCounts?,
    selected: String?,
    locale: Locale,
): List<CategoryLink> {
    val byKey = counts?.categories.orEmpty().associate { it.category.value to it.courseCount }
    val collator = remember(locale) { Collator.getInstance(locale) }
    val all = CategoryLink(null, stringResource(R.string.catalog_all), counts?.total ?: 0, selected == null)
    val subjects =
        Subject.entries
            .mapNotNull { subject -> subject.label?.let { subject to stringResource(it) } }
            .filter { (subject) -> (byKey[subject.key] ?: 0) > 0 || subject.key == selected }
            .sortedWith(compareBy(collator) { it.second })
            .map { (subject, label) -> CategoryLink(subject.key, label, byKey[subject.key] ?: 0, subject.key == selected) }

    return listOf(all) + subjects
}

@Composable
private fun CategoryList(
    categories: List<CategoryLink>,
    onSelect: (String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val description = stringResource(R.string.catalog_categories)
    val locale = currentLocale()

    Column(modifier.padding(12.dp).selectableGroup().semantics { paneTitle = description }) {
        categories.forEach { link ->
            NavigationDrawerItem(
                label = { Text(link.label, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                selected = link.selected,
                onClick = { onSelect(link.key) },
                icon = link.key?.let { { SubjectGlyph(Subject.of(it)) } },
                badge = {
                    Text(
                        formatNumber(link.count.toDouble(), locale),
                        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                    )
                },
            )
        }
    }
}

@Composable
private fun CatalogHeader(
    categories: List<CategoryLink>?,
    onSelect: (String?) -> Unit,
    onGoal: (String) -> Unit,
) {
    var goal by rememberSaveable { mutableStateOf("") }
    val description = stringResource(R.string.catalog_categories)

    Column(Modifier.padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            stringResource(R.string.catalog_subtitle),
            modifier = Modifier.padding(horizontal = 16.dp).widthIn(max = COLUMN_WIDTH),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyLarge,
        )

        GoalBox(value = goal, onValueChange = {
            goal = it
        }, onSubmit = onGoal, modifier = Modifier.padding(horizontal = 16.dp).widthIn(max = COLUMN_WIDTH))

        if (categories != null) {
            LazyRow(
                modifier = Modifier.selectableGroup().semantics { contentDescription = description },
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(categories.size, key = { categories[it].key ?: "all" }) { index ->
                    val link = categories[index]

                    FilterChip(
                        selected = link.selected,
                        onClick = { onSelect(link.key) },
                        label = { Text(link.label) },
                        leadingIcon =
                            when {
                                link.selected -> {
                                    { Icon(painterResource(R.drawable.ic_check), contentDescription = null, Modifier.size(18.dp)) }
                                }

                                link.key != null -> {
                                    { SubjectGlyph(Subject.of(link.key)) }
                                }

                                else -> {
                                    null
                                }
                            },
                    )
                }
            }
        }
    }
}

@Composable
private fun CourseGrid(
    app: AppContainer,
    catalog: CatalogStore,
    navigator: AppNavigator,
    list: CourseList,
    state: LoadState<CoursePage>,
    gridState: LazyGridState,
    header: @Composable () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val page = state.value
    val scope = rememberCoroutineScope()
    var isLoadingMore by remember(list) { mutableStateOf(false) }
    var loadMoreFailed by rememberSaveable(list) { mutableStateOf(false) }

    val loadMore = {
        if (!isLoadingMore) {
            isLoadingMore = true
            loadMoreFailed = false
            scope.launch {
                loadMoreFailed = !catalog.loadMore(list)
                isLoadingMore = false
            }
        }
    }

    // Main's list loads the next page as its end scrolls into view.
    LaunchedEffect(gridState, list, page?.nextCursor) {
        snapshotFlow {
            gridState.layoutInfo.visibleItemsInfo
                .lastOrNull()
                ?.index ?: 0
        }.distinctUntilChanged()
            .filter { last -> page?.nextCursor != null && last >= gridState.layoutInfo.totalItemsCount - LOAD_AHEAD }
            .collect { if (!loadMoreFailed) loadMore() }
    }

    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 320.dp),
        state = gridState,
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 24.dp),
    ) {
        item(key = "header", span = { GridItemSpan(maxLineSpan) }, contentType = "header") { header() }

        when (state) {
            LoadState.Idle, LoadState.Loading -> {
                item(key = "loading", span = { GridItemSpan(maxLineSpan) }) {
                    Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                }
            }

            is LoadState.Failed -> {
                item(key = "failed", span = { GridItemSpan(maxLineSpan) }) { LoadFailedMessage(onRetry = onRetry) }
            }

            LoadState.Empty -> {
                item(key = "empty", span = { GridItemSpan(maxLineSpan) }) {
                    EmptyState(
                        icon = R.drawable.ic_edit_square,
                        title = stringResource(R.string.catalog_empty_title),
                        description = stringResource(R.string.catalog_empty_description),
                        modifier = Modifier.padding(16.dp),
                        action =
                            list.category?.let {
                                {
                                    OutlinedButton(onClick = { navigator.open(AppRoute.StartGoal()) }) {
                                        Icon(painterResource(R.drawable.ic_add), contentDescription = null, Modifier.size(18.dp))
                                        Spacer(Modifier.size(8.dp))
                                        Text(stringResource(R.string.catalog_start_goal))
                                    }
                                }
                            },
                    )
                }
            }

            is LoadState.Loaded -> {
                item(key = "courses-top", span = { GridItemSpan(maxLineSpan) }) { HorizontalDivider(Modifier.padding(top = 8.dp)) }

                items(state.value.courses, key = { it.id.toString() }, contentType = { "course" }) { course ->
                    CourseCell(app, course, list.category) { navigator.open(AppRoute.CatalogCourse(course.id.toString())) }
                }

                item(key = "more", span = { GridItemSpan(maxLineSpan) }) {
                    LoadMoreFooter(isLoading = isLoadingMore, failed = loadMoreFailed, onRetry = loadMore)
                }
            }
        }
    }
}

@Composable
private fun LoadMoreFooter(
    isLoading: Boolean,
    failed: Boolean,
    onRetry: () -> Unit,
) {
    val loadingLabel = stringResource(R.string.catalog_loading_more)

    Box(Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
        when {
            isLoading -> {
                CircularProgressIndicator(Modifier.size(24.dp).semantics { contentDescription = loadingLabel }, strokeWidth = 2.dp)
            }

            failed -> {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        stringResource(R.string.catalog_load_more_failed),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    OutlinedButton(onClick = onRetry) {
                        Icon(painterResource(R.drawable.ic_refresh), contentDescription = null, Modifier.size(18.dp))
                        Spacer(Modifier.size(8.dp))
                        Text(stringResource(R.string.load_failed_try_again))
                    }
                }
            }
        }
    }
}

@Composable
private fun CourseCell(
    app: AppContainer,
    course: CourseResult,
    category: String?,
    onClick: () -> Unit,
) {
    val locale = currentLocale()
    val subject = Subject.of(course.subject?.value)
    val description = course.description?.let { firstSentence(it, course.language) }

    Column {
        Row(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            CourseMark(app, course.imageUrl, course.languageFlag, course.targetLanguage)

            Column(Modifier.weight(1f)) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        course.title,
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (subject.key != category) SubjectLabel(subject)
                }

                if (!description.isNullOrEmpty()) {
                    Spacer(Modifier.size(4.dp))
                    Text(
                        description,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                if (course.lessonCount > 0) {
                    Spacer(Modifier.size(6.dp))
                    Text(
                        pluralStringResource(
                            R.plurals.catalog_course_meta,
                            course.lessonCount.toInt(),
                            course.lessonCount.toInt(),
                            formatTotalDuration(course.estimatedMinutes.toDouble(), locale),
                        ),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                    )
                }
            }
        }
        HorizontalDivider()
    }
}

/** Main's `getFirstSentence`, by the course's own language. */
internal fun firstSentence(
    text: String,
    language: String,
): String {
    val trimmed = text.trim()
    val sentences = BreakIterator.getSentenceInstance(Locale.forLanguageTag(language)).apply { setText(trimmed) }
    val end = sentences.next().takeIf { it != BreakIterator.DONE } ?: trimmed.length
    return trimmed.substring(0, end).trim()
}

private const val LOAD_AHEAD = 4
