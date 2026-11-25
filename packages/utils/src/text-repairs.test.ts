import { assert, constantFrom, pre, property, string } from "fast-check";
import { describe, expect, it } from "vitest";
import { findUnrenderedMarkdown } from "./text-flaws";
import { repairMarkdown, toPlainLine } from "./text-repairs";

describe(repairMarkdown, () => {
  it("leaves text the player renders exactly as written", () => {
    const text = [
      "Cada valor vale **10 mil viagens** e o filme se chama *Caminhos*: `COUNT(*)`.",
      "",
      "| Sensor | mm |",
      "|---|---:|",
      "| A | 49,8 |",
      "",
      String.raw`A área é $\pi r^2$, user_id fica igual e 2 * 3 * 4 também.`,
    ].join("\r\n");

    expect(repairMarkdown({ layout: "blocks", text })).toBe(text);
  });

  it("takes out italics split across lines, keeping the words", () => {
    const text = "_Presidente: a sessão está aberta.\nO orador tem a palavra aqui._";
    const repaired = repairMarkdown({ layout: "blocks", text });

    expect(repaired).toBe("Presidente: a sessão está aberta.\nO orador tem a palavra aqui.");
    expect(findUnrenderedMarkdown({ layout: "blocks", text: repaired })).toStrictEqual([]);
  });

  it("takes out bold marks nobody can pair and keeps the ones that pair", () => {
    expect(repairMarkdown({ layout: "blocks", text: "O **total** é **10 reais." })).toBe(
      "O **total** é 10 reais.",
    );
  });

  it("keeps math and code as written while taking out stray marks around them", () => {
    const text = String.raw`Use $a_1 + a_2$ e \`x_y\`, depois veja **isto.`;

    expect(repairMarkdown({ layout: "blocks", text })).toBe(
      String.raw`Use $a_1 + a_2$ e \`x_y\`, depois veja isto.`,
    );
  });

  it("takes out bold and italics around a formula, which every player shows as raw marks", () => {
    const stray = [
      ["**the $10^{3}$ rule** here", "the $10^{3}$ rule here"],
      ["**$E = mc^2$**", "$E = mc^2$"],
      ["*about $x^2$ squared*", "about $x^2$ squared"],
      ["Use **$v = d / t$** to find speed.", "Use $v = d / t$ to find speed."],
      ["- **the $n$th term** grows", "- the $n$th term grows"],
      [
        "_$x$ is greater than 10 is neither true nor false.",
        "$x$ is greater than 10 is neither true nor false.",
      ],
      ["_$x$ is greater than 10_ is open.", "$x$ is greater than 10 is open."],
      ["*$x$ is even*", "$x$ is even"],
      ["Take _the value $x$_ now.", "Take the value $x$ now."],
    ] as const;

    for (const [text, repaired] of stray) {
      expect(findUnrenderedMarkdown({ layout: "blocks", text })).toStrictEqual([
        expect.stringContaining("emphasis marks"),
      ]);

      expect(repairMarkdown({ layout: "blocks", text })).toBe(repaired);
    }
  });

  it("leaves bold beside a formula or around a price, which every player draws", () => {
    for (const text of [
      "It costs $5 or **about $10** now.",
      "**$20.12**",
      "It is **bold** and $x^2$ math",
    ]) {
      expect(findUnrenderedMarkdown({ layout: "blocks", text })).toStrictEqual([]);
      expect(repairMarkdown({ layout: "inline", text })).toBe(text);
    }
  });

  it("never reads a comparison inside math as an HTML tag", () => {
    for (const text of [
      String.raw`V(x)=-V_0 pour \(|x|<a\) et V(x)=0 ailleurs, avec \(a>0\).`,
      String.raw`Pour \(0<p<1\), si \(p>0{,}5\) alors`,
      "If $x<b$ and $y>c$, then",
    ]) {
      expect(findUnrenderedMarkdown({ layout: "inline", text })).toStrictEqual([]);
      expect(repairMarkdown({ layout: "inline", text: `${text} **` })).toBe(`${text} `);
    }
  });

  it("repairs text between formulas without touching the formulas", () => {
    expect(
      repairMarkdown({
        layout: "blocks",
        text: String.raw`**Se \(0<a\), veja [isto](https://a.com) e $b>0$.`,
      }),
    ).toBe(String.raw`Se \(0<a\), veja isto e $b>0$.`);
  });

  it("turns a link whose words hold a formula into plain words, keeping the formula", () => {
    expect(
      repairMarkdown({ layout: "blocks", text: "See [the $x^2$ rule](https://example.com)." }),
    ).toBe("See the $x^2$ rule.");
  });

  it("reads a table cell as the player does, keeping math with an escaped pipe whole", () => {
    const text = String.raw`| Value |
| --- |
| $\|x^{**}\|$ |
| **norm** $\|v\|$ ** |`;

    expect(findUnrenderedMarkdown({ layout: "blocks", text })).toStrictEqual([
      expect.stringContaining(String.raw`"**norm** $\|v\|$ **"`),
    ]);

    expect(repairMarkdown({ layout: "blocks", text })).toBe(String.raw`| Value |
| --- |
| $\|x^{**}\|$ |
| **norm** $\|v\|$  |`);
  });

  it("turns headings, quote marks and links into plain words", () => {
    const text = ["## Resumo", "> citação do texto", "Veja [a lei](https://example.com/lei)."].join(
      "\n",
    );

    const repaired = repairMarkdown({ layout: "blocks", text });

    expect(repaired).toBe(["Resumo", "citação do texto", "Veja a lei."].join("\n"));
    expect(findUnrenderedMarkdown({ layout: "blocks", text: repaired })).toStrictEqual([]);
  });

  it("never takes out a tag, which can be what the lesson teaches, and leaves it for a writer", () => {
    const tags = [
      "Wrap the description in <p> and </p> inside the section.",
      'A link starts with <a href="/menu"> and ends with </a>.',
      "Linha um<br>linha dois e <strong>leia</strong>.",
      "Use ``<a title={`Ver`}>Ver</a>`` aqui.",
    ];

    for (const layout of ["blocks", "inline"] as const) {
      for (const text of tags) {
        expect(repairMarkdown({ layout, text: `## ${text}` })).toBe(text);
        expect(findUnrenderedMarkdown({ layout, text })).not.toStrictEqual([]);
      }
    }

    const cell = "| Tag | Job |\n|---|---|\n| <h1> | **main heading |";

    expect(repairMarkdown({ layout: "blocks", text: cell })).toBe(
      "| Tag | Job |\n|---|---|\n| <h1> | main heading |",
    );
  });

  it("turns a link with a title and an angle-bracket link into plain words", () => {
    const text = 'Ligue [para nós](tel:+5511999999999 "Central") ou abra <sms:+5511999999999>.';
    const repaired = repairMarkdown({ layout: "blocks", text });

    expect(repaired).toBe("Ligue para nós ou abra sms:+5511999999999.");
    expect(findUnrenderedMarkdown({ layout: "blocks", text: repaired })).toStrictEqual([]);
  });

  it("turns links with a parenthesized or escaped title into plain words", () => {
    const text = String.raw`[Ligue](tel:+5511999999999 (Central)) ou [veja](https://x.test "a \"b\"").`;

    expect(repairMarkdown({ layout: "inline", text })).toBe("Ligue ou veja.");
  });

  it("keeps a list's marks and a comparison that only looks like a quote", () => {
    const text = "- **um item\n> 5 anos: acima do limite";
    const repaired = repairMarkdown({ layout: "blocks", text });

    expect(repaired).toBe("- um item\n> 5 anos: acima do limite");
    expect(findUnrenderedMarkdown({ layout: "blocks", text: repaired })).toHaveLength(1);
  });

  it("repairs marks inside a table's cells without breaking the table", () => {
    const text = "| Termo | Exemplo |\n|---|---|\n| **dolo | [art. 18](https://lei) |";

    expect(repairMarkdown({ layout: "blocks", text })).toBe(
      "| Termo | Exemplo |\n|---|---|\n| dolo | art. 18 |",
    );
  });

  it("joins a one-line field's lines, which it never showed, while repairing it", () => {
    expect(repairMarkdown({ layout: "inline", text: "## Um **título\n  em duas linhas" })).toBe(
      "Um título em duas linhas",
    );
  });

  it("repairs marks around a code block and keeps every character of the code", () => {
    const code = ["```python", "# soma", "def f(*args, **kwargs):", "    return [a](b)", "```"];

    expect(repairMarkdown({ layout: "blocks", text: ["## Veja **isto", ...code].join("\n") })).toBe(
      ["Veja isto", ...code].join("\n"),
    );
  });

  it("keeps inline code as written while repairing the words around it", () => {
    expect(repairMarkdown({ layout: "inline", text: "O que `<div>` contém em **HTML?" })).toBe(
      "O que `<div>` contém em HTML?",
    );

    expect(repairMarkdown({ layout: "blocks", text: "## O que `<div>` e `[a](b)` contêm?" })).toBe(
      "O que `<div>` e `[a](b)` contêm?",
    );
  });

  it("takes out emphasis around inline code, which players show as raw marks", () => {
    const stray = [
      ["**Use `x` here**", "Use `x` here"],
      ["*see `a_b` now*", "see `a_b` now"],
      ["- **call `f()`** first", "- call `f()` first"],
    ] as const;

    for (const layout of ["blocks", "inline"] as const) {
      for (const [text, repaired] of stray) {
        expect(findUnrenderedMarkdown({ layout, text })).toStrictEqual([
          expect.stringContaining("emphasis marks"),
        ]);

        expect(repairMarkdown({ layout, text })).toBe(repaired);
      }
    }
  });

  it("leaves no emphasis mark the check would still flag", () => {
    const pieces = constantFrom("a", " ", "**", "*", "_", "`", "$", "\n", "```", "- ");

    assert(
      property(
        string({ maxLength: 16, unit: pieces }),
        constantFrom("blocks", "inline"),
        (text, layout) => {
          pre(layout === "blocks" || !text.includes("```"));

          expect(
            findUnrenderedMarkdown({ layout, text: repairMarkdown({ layout, text }) }),
          ).not.toContainEqual(expect.stringContaining("emphasis marks"));
        },
      ),
    );
  });

  it("keeps a tilde block's code as written", () => {
    const code = ["~~~html", "<div># título</div>", "~~~"];

    expect(repairMarkdown({ layout: "blocks", text: ["## Veja", ...code].join("\n") })).toBe(
      ["Veja", ...code].join("\n"),
    );
  });

  it("leaves what code can't repair for a writer", () => {
    const table = "| Sensor | mm |\n|---|---:|\n| A | 49,8 |";
    const rows = "| A | 49,8 |\n| B | 50,1 |";
    const fence = "```\nprint(1)\n```";

    expect(repairMarkdown({ layout: "inline", text: table })).toBe(table);
    expect(repairMarkdown({ layout: "blocks", text: rows })).toBe(rows);
    expect(repairMarkdown({ layout: "blocks", text: fence })).toBe(fence);

    const fenceInLine = `Rode **isto:\n${fence}\nagora`;
    expect(repairMarkdown({ layout: "inline", text: fenceInLine })).toBe(fenceInLine);
  });
});

describe(toPlainLine, () => {
  it("reads marked words as plain words on one line, without em dashes", () => {
    expect(toPlainLine("  **Calcular** juros — _compostos_\n em `planilhas`  ")).toBe(
      "Calcular juros, compostos em planilhas",
    );
  });

  it("takes out headings, links and marks nobody can pair", () => {
    expect(toPlainLine("# [Ler gráficos](https://x.y) e tabelas **já")).toBe(
      "Ler gráficos e tabelas já",
    );
  });

  it("keeps a tag as the characters a plain line shows", () => {
    expect(toPlainLine("Agrupe com <div> e `<span>`")).toBe("Agrupe com <div> e <span>");
  });

  it("keeps angle quotes and multiplication as text", () => {
    expect(toPlainLine("O «bem comum» e 2 * 3")).toBe("O «bem comum» e 2 * 3");
  });
});
