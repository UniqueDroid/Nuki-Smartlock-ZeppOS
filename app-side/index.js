import { MessageBuilder } from '../shared/message-side'
import {
  METHOD_GET_STATUS,
  METHOD_ACTION,
  METHOD_LIST_LOCKS,
  METHOD_SELECT_LOCK,
  METHOD_GET_SELECTED_LOCK,
  ERR_NO_LOCK,
} from '../shared/protocol'
import { listLocks, getStatus, performAction } from './nuki-web-backend'

const messageBuilder = new MessageBuilder()

function getSelectedSmartlockId() {
  return settings.settingsStorage.getItem('smartlockId') || ''
}

// Trims a raw Nuki smartlock object down to the handful of fields the
// watch actually renders - concept doc section 4.3, don't pass the full
// Nuki JSON over BLE. Field names match the Nuki Web API docs; NOT yet
// verified against a real response (no token to test with yet) - first
// thing to check once Jan has Settings configured, see the M1 report.
function trimSmartlock(raw) {
  if (!raw) return null
  const state = raw.state || {}
  return {
    id: raw.smartlockId,
    name: raw.name,
    state: state.state,
    batteryCritical: !!state.batteryCritical,
    batteryChargeState: state.batteryChargeState,
    doorsensorState: state.doorsensorState,
  }
}

async function handleListLocks(ctx) {
  const { error, data } = await listLocks()
  if (error) {
    return ctx.response({ data: { error } })
  }
  const locks = (data || []).map(function (l) {
    return { id: l.smartlockId, name: l.name }
  })
  ctx.response({ data: { result: locks } })
}

function handleGetSelectedLock(ctx) {
  ctx.response({ data: { result: { id: getSelectedSmartlockId() } } })
}

// Persists the watch-picked lock into the SAME settingsStorage key the
// phone Settings page's TextInput writes to ('smartlockId') - whichever
// side sets it, getSelectedSmartlockId() above reads it back the same way.
function handleSelectLock(payload, ctx) {
  const id = payload.params && payload.params.id
  if (!id) {
    return ctx.response({ data: { error: ERR_NO_LOCK } })
  }
  settings.settingsStorage.setItem('smartlockId', String(id))
  ctx.response({ data: { result: 'ACK' } })
}

async function handleGetStatus(ctx) {
  const smartlockId = getSelectedSmartlockId()
  if (!smartlockId) {
    return ctx.response({ data: { error: ERR_NO_LOCK } })
  }
  const { error, data } = await getStatus(smartlockId)
  if (error) {
    return ctx.response({ data: { error: error } })
  }
  ctx.response({ data: { result: trimSmartlock(data) } })
}

async function handleAction(payload, ctx) {
  const smartlockId = getSelectedSmartlockId()
  const action = payload.params && payload.params.action
  if (!smartlockId) {
    return ctx.response({ data: { error: ERR_NO_LOCK } })
  }
  const { error } = await performAction(smartlockId, action)
  if (error) {
    return ctx.response({ data: { error: error } })
  }
  // 204 No Content means the command was only ACCEPTED, not that the lock
  // has actually moved yet (concept doc section 2) - M2's job is polling
  // getStatus() a few times after this until the target state is reached.
  // For M1, the watch just gets an ack and re-fetches status itself.
  ctx.response({ data: { result: 'ACK' } })
}

AppSideService({
  onInit() {
    messageBuilder.listen(() => {})

    // docs.zepp.com's settingsStorage page: "This API only needs to be
    // used in the Side Service. The Settings App is 'responsive' to data
    // changes in settingsStorage, so there is no need to manually listen
    // for data changes [there]." - i.e. the Side Service does NOT see the
    // phone Settings page's writes live through getItem() alone, it needs
    // this subscription to actually sync. Confirmed broken without it
    // (Jan's report, 05.10.2026): token saved+persisted fine on the
    // Settings page, but getStatus() kept returning ERR_NO_TOKEN no
    // matter how often the watch app or the phone's Zepp app itself was
    // restarted. The callback body does nothing - getToken()/
    // getSelectedSmartlockId() already call settingsStorage.getItem()
    // fresh on every use, so there's nothing to cache here; just
    // registering the listener is what makes the bridge stay in sync.
    settings.settingsStorage.addListener('change', () => {})

    messageBuilder.on('request', (ctx) => {
      const payload = messageBuilder.buf2Json(ctx.request.payload)
      if (payload.method === METHOD_LIST_LOCKS) {
        return handleListLocks(ctx)
      }
      if (payload.method === METHOD_SELECT_LOCK) {
        return handleSelectLock(payload, ctx)
      }
      if (payload.method === METHOD_GET_SELECTED_LOCK) {
        return handleGetSelectedLock(ctx)
      }
      if (payload.method === METHOD_GET_STATUS) {
        return handleGetStatus(ctx)
      }
      if (payload.method === METHOD_ACTION) {
        return handleAction(payload, ctx)
      }
    })
  },

  onRun() {},

  onDestroy() {},
})
