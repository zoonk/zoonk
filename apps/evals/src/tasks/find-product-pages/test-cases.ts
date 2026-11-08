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
      // Apple's "Identify your iPhone model" lists every model with its year; its iOS update
      // notes list software releases, not models.
      releasesUrl: ["support.apple.com/en-us/108044", "support.apple.com/108044"],
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
    // TDN's `display/.../Release+12.1.2410` address loads its notes by script, so our fetcher reads
    // no date there; only the notes addressed by page id state "Expedição em Outubro/2024".
    expected: {
      releaseUrl: [
        "tdn.totvs.com/pages/viewpage.action?pageId=836052340",
        "tdn.totvs.com/pages/releaseview.action?pageId=836052340",
      ],
    },
    id: "protheus-known-release-notes",
    language: "pt",
    userInput: {
      hints: { brand: "TOTVS", name: "Protheus", release: "Protheus 12.1.2410" },
      knownWebsite: "https://www.totvs.com/sistema-de-gestao/totvs-backoffice-linha-protheus/",
      officialDomains: ["totvs.com"],
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
  {
    expected: {
      brandUrl: ["figma.com"],
      docsUrl: ["help.figma.com", "developers.figma.com"],
      productUrl: ["figma.com"],
      releasesUrl: ["figma.com/release-notes", "figma.com/whats-new"],
    },
    id: "figma",
    language: "en",
    userInput: {
      hints: { brand: "Figma", name: "Figma", release: null },
      officialDomains: ["figma.com"],
    },
  },
  {
    // One product among many on its maker's site: the product page is Excel's own, not
    // Microsoft 365's or the home page.
    expected: {
      brandUrl: ["microsoft.com"],
      docsUrl: ["support.microsoft.com", "learn.microsoft.com"],
      productUrl: [
        "microsoft.com/en-us/microsoft-365/excel",
        "microsoft.com/en-US/microsoft-365/excel",
        "microsoft.com/microsoft-365/excel",
        "microsoft.com/en/microsoft-365/excel",
      ],
    },
    id: "excel",
    language: "en",
    userInput: {
      hints: { brand: "Microsoft", name: "Excel", release: null },
      officialDomains: ["microsoft.com"],
    },
  },
  {
    expected: {
      brandUrl: ["samsung.com"],
      productUrl: ["samsung.com"],
      releaseUrl: ["samsung.com"],
    },
    id: "galaxy-s24",
    language: "pt",
    userInput: {
      hints: { brand: "Samsung", name: "Galaxy S", release: "Galaxy S24" },
      officialDomains: ["samsung.com"],
    },
  },
  {
    expected: {
      brandUrl: ["rdstation.com"],
      docsUrl: ["ajuda.rdstation.com", "developers.rdstation.com"],
      productUrl: ["rdstation.com/produtos/marketing", "rdstation.com/marketing"],
    },
    id: "rd-station-marketing",
    language: "pt",
    userInput: {
      hints: { brand: "RD Station", name: "RD Station Marketing", release: null },
      officialDomains: ["rdstation.com"],
    },
  },
];
