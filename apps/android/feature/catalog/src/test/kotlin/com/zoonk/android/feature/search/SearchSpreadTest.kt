package com.zoonk.android.feature.search

import com.zoonk.android.R
import org.junit.Assert.assertEquals
import org.junit.Test

class SearchSpreadTest {
    private fun group(id: String) = SearchGroup(id, id, listOf(SearchItem("$id-item", id, SearchAction.SendFeedback, R.drawable.ic_search)))

    private fun ids(groups: List<SearchGroup>) = groups.map { it.id }

    @Test
    fun withoutAQueryWhatTheLearnerCanDoFacesThePlacesToGo() {
        val (before, after) = spreadGroups(listOf(group("actions"), group("pages"), group("goals"), group("help")), searching = false)

        assertEquals(listOf("actions", "help"), ids(before))
        assertEquals(listOf("pages", "goals"), ids(after))
    }

    @Test
    fun aQuerysOwnMatchesFaceTheCatalogAndTheWaysToAsk() {
        val (before, after) = spreadGroups(listOf(group("pages"), group("plan"), group("catalog"), group("fallback")), searching = true)

        assertEquals(listOf("pages", "plan"), ids(before))
        assertEquals(listOf("catalog", "fallback"), ids(after))
    }

    @Test
    fun theWaysToAskLeadWhenNothingOfTheLearnersMatches() {
        val (before, after) = spreadGroups(listOf(group("catalog"), group("fallback")), searching = true)

        assertEquals(listOf("fallback"), ids(before))
        assertEquals(listOf("catalog"), ids(after))
    }
}
