package com.zoonk.android.feature.onboarding.setup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CertificateExampleTest {
    @Test
    fun namesTheExamForTheTargetLanguage() {
        assertEquals("DELE", certificateExample("es-MX", null))
        assertNull(certificateExample("eo", null))
        assertNull(certificateExample(null, null))
    }

    @Test
    fun usesThePortugueseCountryWithoutAssumingOne() {
        assertEquals("Celpe-Bras", certificateExample("pt", "BR"))
        assertEquals("CAPLE", certificateExample("pt", "PT"))
        assertEquals("ACTFL OPI", certificateExample("pt", "AO"))
        assertEquals("ACTFL OPI", certificateExample("pt", null))
    }

    @Test
    fun readsTheCountryFromTheTagUnlessTheGoalSetsOne() {
        assertEquals("Celpe-Bras", certificateExample("pt-Latn-br", null))
        assertEquals("CAPLE", certificateExample("pt-Latn-br", "PT"))
        assertEquals("ACTFL OPI", certificateExample("pt-Cyrl-BR", null))
    }
}
