package com.zoonk.android.ui.components

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/** TalkBack reads Compose's own `close_sheet` on every bottom sheet's scrim; ours replaces it in every region. */
@RunWith(AndroidJUnit4::class)
class CloseSheetLabelTest {
    private fun label() = RuntimeEnvironment.getApplication().getString(androidx.compose.ui.R.string.close_sheet)

    @Test
    @Config(qualifiers = "pt-rBR")
    fun brazilianPortugueseReadsAsAPanel() = assertEquals("Fechar painel", label())

    @Test
    @Config(qualifiers = "pt")
    fun portugueseReadsAsAPanel() = assertEquals("Fechar painel", label())

    @Test
    @Config(qualifiers = "de")
    fun germanReadsAsADialog() = assertEquals("Dialog schließen", label())

    @Test
    @Config(qualifiers = "es-rUS")
    fun latinAmericanSpanishReadsAsAPanel() = assertEquals("Cerrar panel", label())

    @Test
    @Config(qualifiers = "fr-rCA")
    fun canadianFrenchReadsAsAPanel() = assertEquals("Fermer le panneau", label())
}
