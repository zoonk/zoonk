package com.zoonk.android.feature.search

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SearchBarValue
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performImeAction
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.summary
import com.zoonk.android.feature.catalog.CHAPTER_TWO
import com.zoonk.android.feature.catalog.COURSE
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.TabRootScaffold
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.CatalogSearchResponse
import com.zoonk.api.models.LearnerSummary
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@OptIn(ExperimentalMaterial3Api::class)
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class SearchFlowTest {
    @get:Rule
    val rule: ComposeContentTestRule = createComposeRule()

    private lateinit var navigator: AppNavigator
    private lateinit var groups: List<SearchGroup>

    private val bonds: CatalogSearchResponse =
        ApiJson.decodeFromString(
            """{"courses":[],"chapters":[{"courseId":"$COURSE","courseSlug":"atoms","courseTitle":"Atoms","description":"How atoms hold on",
                "id":"$CHAPTER_TWO","language":"en","organizationSlug":"zoonk","slug":"bonds","title":"Bonds"}]}""",
        )

    private fun groupsFor(
        query: String,
        summary: LearnerSummary? = null,
        catalog: CatalogSearchResponse? = null,
    ) {
        rule.setContent {
            groups =
                searchGroups(
                    query,
                    SearchSources(summary, signedIn = summary != null, catalog = catalog, syllabus = null, mocks = emptyList()),
                )
        }
        rule.waitForIdle()
    }

    private fun labels(group: String) =
        groups
            .firstOrNull { it.id == group }
            ?.items
            ?.map { it.label }
            .orEmpty()

    @Test
    fun aVisitorSeesMainsPagesAndAWayToStart() {
        groupsFor("")

        assertEquals(listOf("Home page", "Explore courses", "Start a goal", "Pricing", "Log in"), labels("pages"))
        assertEquals(listOf("Blog", "Help"), labels("help"))
    }

    @Test
    fun aQueryFiltersThePlacesAndOffersItAsAGoal() {
        groupsFor("stat", summary(readAt = 0, nextChangeAt = 0))

        assertEquals(listOf("Statistics"), labels("pages"))
        assertEquals(listOf("Start a new goal: “stat”"), labels("fallback"))
    }

    @Test
    fun matchingIgnoresAccentsAndCase() {
        assertTrue(matchesSearch("ESTATISTICA", "Estatística"))
        assertFalse(matchesSearch("ば", "は"))
        assertTrue(matchesSearch("  ", "anything"))
        assertFalse(matchesSearch("plan", "Today"))
    }

    @Test
    fun aCatalogChapterOpensInItsCourse() {
        groupsFor("bonds", catalog = bonds)

        val chapter = groups.first { it.id == "catalog" }.items.single()
        assertEquals(SearchAction.Open(AppRoute.CatalogChapter(CHAPTER_TWO, COURSE)), chapter.action)
        assertEquals("Atoms", chapter.detail)
    }

    @Test
    fun enterOpensWhatTheWordsShowAtOnce() {
        show { app, navigator -> TabSearchBar(app, navigator) }

        rule.onNodeWithText("Search or ask…").performClick()
        rule.mainClock.autoAdvance = false
        rule.onAllNodes(hasSetTextAction()).onLast().performTextInput("settings")
        // One frame, far less than the server search's wait: the places filter on the words as typed.
        rule.mainClock.advanceTimeBy(100)
        rule.onAllNodes(hasSetTextAction()).onLast().performImeAction()
        rule.mainClock.autoAdvance = true

        assertEquals(AppRoute.Settings, navigator.currentRoute)
    }

    @Test
    fun typingAndPickingAPageOpensIt() {
        show { app, navigator -> TabSearchBar(app, navigator) }

        rule.onNodeWithText("Search or ask…").performClick()
        // The collapsed bar keeps its field while the expanded one, drawn over it, takes the words.
        rule.onAllNodes(hasSetTextAction()).onLast().performTextInput("explore")
        rule.mainClock.advanceTimeBy(500)
        rule.onNodeWithText("Explore courses").performClick()

        assertEquals(AppRoute.Catalog(), navigator.currentRoute)
    }

    @Test
    fun searchOpensOverAPageWithoutTheBar() {
        lateinit var search: AppSearch
        show { app, navigator ->
            SearchHost(app, navigator, signedIn = true) { search = checkNotNull(LocalAppSearch.current) }
        }

        rule.runOnIdle { search.open() }
        rule.onAllNodes(hasSetTextAction()).onLast().performTextInput("explore")
        rule.mainClock.advanceTimeBy(500)
        rule.onNodeWithText("Explore courses").performClick()

        assertEquals(AppRoute.Catalog(), navigator.currentRoute)
    }

    @Test
    fun aPagesSearchActionOpensSearchForALearnerOnly() {
        var signedIn by mutableStateOf(false)
        show { app, navigator -> SearchHost(app, navigator, signedIn) { Row { SearchAction() } } }

        rule.onNodeWithContentDescription("Search or ask").assertDoesNotExist()

        signedIn = true
        rule.onNodeWithContentDescription("Search or ask").performClick()
        rule.onAllNodes(hasSetTextAction()).onLast().performTextInput("explore")
        rule.mainClock.advanceTimeBy(500)
        rule.onNodeWithText("Explore courses").performClick()

        assertEquals(AppRoute.Catalog(), navigator.currentRoute)
    }

    @Test
    fun theShortcutOpensTheTabRootsBarWhileItShows() {
        lateinit var search: AppSearch
        show { app, navigator ->
            SearchHost(app, navigator, signedIn = true) {
                search = checkNotNull(LocalAppSearch.current)
                TabSearchBar(app, navigator)
            }
        }

        rule.runOnIdle { search.open() }
        rule.waitForIdle()

        assertEquals(SearchBarValue.Expanded, search.tabBar?.currentValue)
    }

    @Test
    fun thePhonesBarScrollsAwayWithThePageAndBack() {
        show { app, navigator ->
            TabRootScaffold(app, navigator) { padding ->
                LazyColumn(Modifier.fillMaxSize().testTag("page"), contentPadding = padding) {
                    items(100) { Text("Row $it", Modifier.padding(16.dp)) }
                }
            }
        }

        rule.onNodeWithText("Search or ask…").assertIsDisplayed()
        rule.onNodeWithTag("page").performTouchInput { swipeUp() }
        rule.onNodeWithText("Search or ask…").assertIsNotDisplayed()
        // From the middle: the list's top edge sits under the app bar.
        rule.onNodeWithTag("page").performTouchInput { swipeDown(startY = centerY, endY = bottom) }
        rule.onNodeWithText("Search or ask…").assertIsDisplayed()
    }

    private fun show(content: @Composable (AppContainer, AppNavigator) -> Unit) {
        rule.setContent {
            ZoonkTheme {
                val context = LocalContext.current
                val app = remember { AppContainer.preview(context) }
                navigator = rememberAppNavigator()
                content(app, navigator)
            }
        }
    }
}
