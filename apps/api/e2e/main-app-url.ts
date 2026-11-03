/**
 * Nothing on any machine answers here: port 0 can't be listened on, and browsers refuse it as a bad
 * port (https://fetch.spec.whatwg.org/#bad-port). Tests read where a sign-in goes from the request.
 */
export const E2E_MAIN_APP_URL = "http://localhost:0";
