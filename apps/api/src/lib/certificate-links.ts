import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { getCertificateLinks } from "@zoonk/utils/certificate-links";

/** Native apps draw no links of their own: every certificate the API returns carries them. */
export function withCertificateLinks<Facts extends CertificateFacts>(facts: Facts) {
  const { imageUrls, linkedInUrl, url } = getCertificateLinks(facts);
  return { ...facts, imageUrls, linkedInUrl, url };
}
