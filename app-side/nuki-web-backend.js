// Variante A from the concept doc - talks to https://api.nuki.io directly
// with a Bearer token. Kept as its own module (not inlined in index.js) so
// swapping in Variante B (own Proxmox proxy) later is a new
// proxy-backend.js file with the same 3 exported functions, not a rewrite
// of the message-dispatch logic in index.js.
//
// fetch() here is the Zepp OS Side Service global (Node-fetch-like, but
// NOT a real Promise with a working native timeout - see
// fetchWithTimeout() below, concept doc section 4.3).

import {
  ERR_NO_TOKEN,
  ERR_AUTH,
  ERR_OFFLINE,
  ERR_NETWORK,
  ERR_TIMEOUT,
} from '../shared/protocol'

const API_BASE = 'https://api.nuki.io'
const REQUEST_TIMEOUT_MS = 8000

function getToken() {
  return settings.settingsStorage.getItem('nukiToken') || ''
}

// Own timeout via Promise.race - fetch()'s built-in timeout handling is
// unreliable across Zepp-app versions (concept doc section 4.3).
function fetchWithTimeout(url, options) {
  return Promise.race([
    fetch(Object.assign({ url }, options)),
    new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error('timeout')), REQUEST_TIMEOUT_MS)
    }),
  ])
}

// Normalizes every failure mode (missing token, HTTP error, network error,
// our own timeout) into one of the protocol's ERR_* codes, so index.js
// never has to know which backend produced the error.
async function request(method, path, body) {
  const token = getToken()
  if (!token) {
    return { error: ERR_NO_TOKEN }
  }

  let res
  try {
    res = await fetchWithTimeout(API_BASE + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (e) {
    if (e && e.message === 'timeout') {
      return { error: ERR_TIMEOUT }
    }
    return { error: ERR_NETWORK }
  }

  const status = res.status
  if (status === 401 || status === 403) {
    return { error: ERR_AUTH }
  }
  if (status === 503) {
    return { error: ERR_OFFLINE }
  }
  if (status >= 400) {
    return { error: ERR_NETWORK }
  }

  // 204 No Content on the action endpoints (concept doc section 2) - no
  // body to parse, the caller only cares that the request was accepted.
  if (status === 204 || !res.body) {
    return { data: null }
  }

  try {
    var parsed = typeof res.body === 'string' ? JSON.parse(res.body) : res.body
  } catch (e) {
    return { error: ERR_NETWORK }
  }
  return { data: parsed }
}

// GET /smartlock - full list, for the Settings app's "Load locks" picker.
export function listLocks() {
  return request('GET', '/smartlock')
}

// GET /smartlock/{id} - trimmed by index.js before it goes back to the
// watch (concept doc section 4.3 - don't pass the raw Nuki JSON over BLE).
export function getStatus(smartlockId) {
  return request('GET', '/smartlock/' + smartlockId)
}

// action: 1 = unlock, 2 = lock, 3 = unlatch (Nuki Web API's own action ids)
const ACTION_IDS = { lock: 2, unlock: 1, unlatch: 3 }

export function performAction(smartlockId, action) {
  const actionId = ACTION_IDS[action]
  if (!actionId) {
    return Promise.resolve({ error: ERR_NETWORK })
  }
  return request('POST', '/smartlock/' + smartlockId + '/action', {
    action: actionId,
  })
}
