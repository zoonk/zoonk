import { certificateFactsShape, ownedCertificateShape } from "@zoonk/core/certificates/contract";
import { z } from "zod";

const certificateLinksShape = {
  imageUrls: z
    .object({
      link: z.url().meta({ description: "1200 × 630, the picture a shared link unfurls with" }),
      post: z.url().meta({ description: "1080 × 1350, to upload as a social post" }),
      print: z
        .url()
        .meta({ description: "The certificate itself, landscape, for print and saving" }),
    })
    .meta({
      description:
        "PNG pictures of the certificate, public (no auth header). They change when the learner's name changes",
      id: "CertificateImageUrls",
    }),
  linkedInUrl: z
    .url()
    .meta({
      description:
        "Opens LinkedIn's form to add the certificate to the learner's profile; LinkedIn may not prefill it, so also show the name, issuer, issue date, ID and URL to copy",
    }),
  url: z.url().meta({ description: "The certificate's public verification page" }),
};

export const certificateSchema = z
  .object({ ...certificateFactsShape, ...certificateLinksShape })
  .meta({
    description: "A certificate as anyone with its link sees it, with its page and pictures",
    id: "Certificate",
  });

export const ownedCertificateSchema = z
  .object({ ...ownedCertificateShape, ...certificateLinksShape })
  .meta({ description: "One of the learner's own certificates", id: "OwnedCertificate" });

export const certificateListResponseSchema = z
  .object({
    certificates: z
      .array(ownedCertificateSchema)
      .meta({ description: "Newest first; empty until the learner earns one" }),
  })
  .meta({ id: "CertificateList" });
