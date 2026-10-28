/** A message catalog, as next-intl's loader turns a `.po` file into a module. */
declare module "*.po" {
  const messages: Record<string, unknown>;
  export default messages;
}
