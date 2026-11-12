package com.zoonk.android.feature.country

import org.junit.Assert.assertEquals
import org.junit.Test

class CountrySearchTest {
    private val names = listOf("Estados Unidos", "Reino Unido", "Emirados Árabes Unidos", "Áustria", "Guiné-Bissau", "Uganda")

    private fun search(query: String) = names.filter { matchesCountry(query, it) }

    @Test
    fun anyWordStartsAMatchWhateverItsCaseAndAccents() {
        assertEquals(listOf("Estados Unidos", "Reino Unido", "Emirados Árabes Unidos"), search("uni"))
        assertEquals(listOf("Emirados Árabes Unidos", "Áustria"), search("A"))
        assertEquals(listOf("Guiné-Bissau"), search("bissau"))
        assertEquals(listOf("Reino Unido"), search("reino u"))
        assertEquals(emptyList<String>(), search("nido"))
    }
}
