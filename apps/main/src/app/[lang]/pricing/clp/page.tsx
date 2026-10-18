import { PricingPage, getPricingPageMetadata } from "@/components/pricing/pricing-page";

export const generateMetadata = () => getPricingPageMetadata();

export default function PricingInCurrency() {
  return <PricingPage currency="clp" />;
}
