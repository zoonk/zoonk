"use cache";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  return <main>home page: {locale}</main>;
}
