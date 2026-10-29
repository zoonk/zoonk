package com.zoonk.android.feature.search

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onLast
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.summary
import com.zoonk.android.feature.catalog.CHAPTER_TWO
import com.zoonk.android.feature.catalog.COURSE
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
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
        assertEquals(listOf("Blog", "Send feedback", "Help"), labels("help"))
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
    fun typingAndPickingAPageOpensIt() {
        show { app, navigator -> TabSearchBar(app, navigator) }

        rule.onNodeWithText("Search or ask…").performClick()
        // The collapsed bar keeps its field while the expanded one, drawn over it, takes the words.
        rule.onAllNodes(hasSetTextAction()).onLast().performTextInput("explore")
        rule.mainClock.advanceTimeBy(500)
        rule.onNodeWithText("Explore courses").performClick()

        assertEquals(AppRoute.Catalog(), navigator.currentRoute)
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
