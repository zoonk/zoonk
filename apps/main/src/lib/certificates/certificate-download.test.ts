import { describe, expect, it } from "vitest";
import { getCertificateDownloadDisposition } from "./certificate-download";

describe(getCertificateDownloadDisposition, () => {
  it("names the file after the learner and what they finished", () => {
    expect(
      getCertificateDownloadDisposition({
        name: "Ana Souza",
        title: "Quantum physics from scratch",
      }),
    ).toBe(
      "attachment; filename=\"Ana Souza - Quantum physics from scratch - Zoonk.png\"; filename*=UTF-8''Ana%20Souza%20-%20Quantum%20physics%20from%20scratch%20-%20Zoonk.png",
    );
  });

  it("keeps any script in filename* and an ASCII copy in filename", () => {
    const disposition = getCertificateDownloadDisposition({
      name: "Conceição O'Brien",
      title: "山田",
    });

    expect(disposition).toContain('filename="Conceicao O\'Brien - Zoonk.png"');

    expect(disposition).toContain(
      "filename*=UTF-8''Concei%C3%A7%C3%A3o%20O%27Brien%20-%20%E5%B1%B1%E7%94%B0%20-%20Zoonk.png",
    );
  });

  it("drops characters a file system refuses and leaves out a missing name", () => {
    expect(
      getCertificateDownloadDisposition({ name: null, title: 'Data: "A/B" testing\nbasics' }),
    ).toContain('filename="Data A B testing basics - Zoonk.png"');
  });
});
