/** The row changed after it was read and before the store's answer was saved: read the store again. */
export class StoreSubscriptionChangedError extends Error {
  constructor() {
    super("Store subscription changed while the store was read");
    this.name = "StoreSubscriptionChangedError";
  }
}
