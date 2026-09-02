// Single source of truth for messages exchanged between the Device App
// (watch) and the Side Service (phone) - see the concept doc, section 4.1.
// Both sides import this file, so a typo in a message/error string is a
// build-time reference error instead of a silent runtime mismatch.

// Device App -> Side Service request methods (used as messageBuilder's
// jsonRpc `method` field).
export const METHOD_GET_STATUS = 'GET_STATUS'
export const METHOD_ACTION = 'ACTION'
export const METHOD_LIST_LOCKS = 'LIST_LOCKS'
// On-watch Settings screen (no phone Settings page needed for this one
// field) - picks a smartlock from LIST_LOCKS's result and persists it
// into the same settingsStorage key the phone Settings page also uses.
export const METHOD_SELECT_LOCK = 'SELECT_LOCK'
// Lets the on-watch Settings screen show the ID actually saved right now,
// instead of always showing a hardcoded placeholder regardless of state -
// otherwise re-opening the screen looks like the value was never saved,
// even when it was (Jan's report, 02.09.2026).
export const METHOD_GET_SELECTED_LOCK = 'GET_SELECTED_LOCK'

// ACTION request's `action` param.
export const ACTION_LOCK = 'lock'
export const ACTION_UNLOCK = 'unlock'
export const ACTION_UNLATCH = 'unlatch'

// Side Service -> Device App error codes (concept doc, section 4.2) - sent
// as the `error` field of a response, alongside `result: null`.
export const ERR_NO_TOKEN = 'ERR_NO_TOKEN'   // Settings app has no API token saved yet
export const ERR_NO_LOCK = 'ERR_NO_LOCK'     // token is there, but no smartlock picked yet
export const ERR_AUTH = 'ERR_AUTH'           // Nuki API returned 401
export const ERR_OFFLINE = 'ERR_OFFLINE'     // Nuki API returned 503 / bridge/lock unreachable
export const ERR_NETWORK = 'ERR_NETWORK'     // fetch() itself threw (no network on the phone)
export const ERR_TIMEOUT = 'ERR_TIMEOUT'     // our own 8s watchdog fired, see side-service's fetchWithTimeout()

// Nuki smartlock `state` values (concept doc, section 3.3) - the Nuki Web
// API's numeric lock state, mapped to a short display label on the watch.
export const NUKI_STATE_LOCKED = 1
export const NUKI_STATE_UNLOCKED = 3
export const NUKI_STATE_UNLATCHED = 5
// 2/4/7 = various "in motion" states, 254/255 = motor blocked/undefined -
// anything not explicitly listed above is treated as "unknown" by the UI.
