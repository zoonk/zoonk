import { type TestCase } from "@/lib/types";
import { type FindProductPagesParams } from "@zoonk/ai/tasks/research/find-product-pages";
import { type FindProductPagesExpected } from "./task";

export const TEST_CASES: TestCase<FindProductPagesExpected, FindProductPagesParams>[] = [
  {
    expected: {
      brandUrl: ["vercel.com"],
      docsUrl: ["nextjs.org/docs"],
      productUrl: ["nextjs.org"],
      releasesUrl: ["nextjs.org/blog", "github.com/vercel/next.js/releases"],
    },
    id: "nextjs",
    language: "en",
    userInput: {
      hints: { brand: "Vercel", name: "Next.js", release: null },
      officialDomains: ["nextjs.org", "vercel.com"],
    },
  },
  {
    expected: {
      brandUrl: ["apple.com"],
      docsUrl: ["support.apple.com"],
      productUrl: ["apple.com/iphone"],
      releaseUrl: ["support.apple.com", "apple.com"],
      releasesUrl: ["support.apple.com", "apple.com"],
    },
    id: "iphone-13",
    language: "en",
    userInput: {
      hints: { brand: "Apple", name: "iPhone", release: "iPhone 13" },
      officialDomains: ["apple.com", "support.apple.com"],
    },
  },
  {
    expected: {
      brandUrl: ["linear.app"],
      docsUrl: ["linear.app/docs"],
      productUrl: ["linear.app"],
    },
    id: "linear",
    language: "en",
    userInput: {
      hints: { brand: "Linear", name: "Linear", release: null },
      officialDomains: ["linear.app"],
    },
  },
  {
    expected: {
      brandUrl: ["nubank.com.br", "nu.com.br"],
      productUrl: ["nubank.com.br", "nu.com.br"],
    },
    id: "nubank",
    language: "pt",
    userInput: {
      hints: { brand: "Nubank", name: "Nubank", release: null },
      officialDomains: ["nubank.com.br"],
    },
  },
  {
    expected: {
      brandUrl: ["totvs.com"],
      docsUrl: ["tdn.totvs.com"],
      productUrl: [
        "totvs.com/sistema-de-gestao/totvs-backoffice-linha-protheus",
        "produtos.totvs.com/produto/totvs-backoffice/totvs-backoffice-linha-protheus",
      ],
      releasesUrl: ["tdn.totvs.com"],
    },
    id: "protheus",
    language: "pt",
    userInput: {
      hints: { brand: "TOTVS", name: "Protheus", release: null },
      officialDomains: ["totvs.com", "tdn.totvs.com"],
    },
  },
  {
    expected: {
      brandUrl: ["totvs.com"],
      docsUrl: ["tdn.totvs.com"],
      productUrl: [
        "totvs.com/sistema-de-gestao/totvs-backoffice-linha-protheus",
        "produtos.totvs.com/produto/totvs-backoffice/totvs-backoffice-linha-protheus",
      ],
      releaseUrl: ["tdn.totvs.com"],
      releasesUrl: ["tdn.totvs.com"],
    },
    id: "protheus-release",
    language: "pt",
    userInput: {
      hints: { brand: "TOTVS", name: "Protheus", release: "12.1.2410" },
      officialDomains: ["totvs.com", "tdn.totvs.com"],
    },
  },
  {
    expected: {
      brandUrl: null,
      docsUrl: null,
      productUrl: null,
      releaseUrl: null,
      releasesUrl: null,
    },
    id: "internal-tool",
    language: "en",
    userInput: {
      hints: { brand: "Brightwave Dental", name: "Brightwave Scheduler", release: null },
      officialDomains: [],
    },
  },
];
