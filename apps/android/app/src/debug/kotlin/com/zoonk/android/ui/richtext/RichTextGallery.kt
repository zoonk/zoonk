package com.zoonk.android.ui.richtext

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.theme.ZoonkTheme

internal object RichTextSamples {
    val question = "An R$ 80 T-shirt is 25% off. How much do you pay?"

    val explanation =
        "25% off doesn't mean you pay 25%. It means you **don't** pay 25%. You pay the rest: 100% − 25% = **75%**.\n\n" +
            "So go straight to what you pay: 75% of 80 = 0.75 × 80 = **R$ 60**."

    val list =
        "No calculator? Start from 10%, which is just moving the decimal point one place: 10% of 80 is 8.\n\n" +
            "- 20% is two 10%s: 16\n- 5% is half of 10%: 4\n- 25% = 20% + 5% = 16 + 4 = 20\n\nThen subtract: 80 − 20 = R$ 60."

    val steps = "Two rules:\n\n1. Rises add.\n2. Falls **subtract**.\n3. Repeat until 350000 kcal."

    val table =
        "Uma tabela mostra as bicicletas:\n| Hora | Bicicletas |\n|---|---:|\n| 7h | 9 |\n| **8h** | \$5$ |\n\nQual horário teve menos?"

    val wideTable =
        "| Linie | Durchschnittlicher Fahrpreis | Fahrgäste pro Tag | Pünktlichkeit |\n" +
            "| --- | ---: | ---: | :---: |\n| U1 | 2,80 € | 120000 | 94 % |\n| S41 *(Ring)* | 3,20 € | 95000 | 89 % |"

    val math =
        "So \$0.75 \\times 80 = 60$ and $\$A = P(1+r)^t$$ too. The speed in orbit is $\$v = \\sqrt{\\frac{GM}{r}}$$, " +
            "and \\(x_1^2 + x_2^2\\) adds up."

    val formula = "\\lambda\\ (\\text{nm}) = \\dfrac{1240}{E\\ (\\text{eV})}"

    val marked = "A change multiplies the **current** value. Then it repeats."
    val mark = "A change multiplies the **current** value."

    val code = "Count the rows with `COUNT(*)`; `user_id` and 2 * 3 * 4 stay as written, «quoted words» lean."

    val tutorAnswer =
        "## Why 75%?\n\nA discount takes **25%** off, so you pay the rest:\n\n" +
            "$$0.75 \\times 80 = 60$$\n\n1. Start from 100%.\n2. Take away the discount.\n   - 100% − 25% = 75%\n\n" +
            "> Mixing up what you save and what you pay is a common slip.\n\n" +
            "See [percent basics](https://www.zoonk.com/learn) or try:\n\n```python\nprice * 0.75\n```"
}

@Composable
internal fun RichTextGallery(modifier: Modifier = Modifier) {
    Surface(modifier) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            RichInlineText(RichTextSamples.question, style = MaterialTheme.typography.titleLarge)
            RichText(RichTextSamples.explanation)
            HorizontalDivider()
            RichText(RichTextSamples.list)
            RichText(RichTextSamples.steps)
            HorizontalDivider()
            RichText(RichTextSamples.table)
            RichText(RichTextSamples.wideTable)
            HorizontalDivider()
            RichText(RichTextSamples.math)
            MathText(RichTextSamples.formula)
            HorizontalDivider()
            RichText(RichTextSamples.marked, mark = RichTextSamples.mark)
            RichText(RichTextSamples.code)
            HorizontalDivider()
            MarkdownText(RichTextSamples.tutorAnswer, onOpenLink = {})
        }
    }
}

@Preview(name = "Light", widthDp = 411, heightDp = 2000)
@Preview(name = "Dark", widthDp = 411, heightDp = 2000, uiMode = android.content.res.Configuration.UI_MODE_NIGHT_YES)
@Preview(name = "200% font", widthDp = 411, heightDp = 3200, fontScale = 2f)
@Composable
private fun RichTextGalleryPreview() {
    ZoonkTheme {
        RichTextGallery()
    }
}
