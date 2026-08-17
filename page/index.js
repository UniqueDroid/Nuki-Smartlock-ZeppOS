// M1 "Durchstich" screen (concept doc section 8): button -> Side Service
// -> Nuki API -> response shown on the watch. Deliberately NOT the full
// State Machine from section 3.2 yet (SENDING/PENDING/SUCCESS/ERROR,
// disabled buttons during a pending action, distinct haptics per
// outcome) - that's M2. This just proves the BLE round-trip and the Nuki
// Web API call work end to end.
import * as hmUI from '@zos/ui'
import { DEVICE_WIDTH, DEVICE_HEIGHT } from '../utils/config/device'
import {
  METHOD_GET_STATUS,
  METHOD_ACTION,
  ACTION_LOCK,
  ACTION_UNLOCK,
  ERR_NO_TOKEN,
  ERR_NO_LOCK,
  ERR_AUTH,
  ERR_OFFLINE,
  ERR_NETWORK,
  ERR_TIMEOUT,
  NUKI_STATE_LOCKED,
  NUKI_STATE_UNLOCKED,
  NUKI_STATE_UNLATCHED,
} from '../shared/protocol'

// Human-readable text for every outcome the Side Service can report -
// concept doc section 3.3 (lock state) and 4.2 (error codes) combined
// into one lookup, since this M1 screen only has room for one status
// line, not the separate icon+color treatment M2/M4 will add.
const STATE_LABELS = {}
STATE_LABELS[NUKI_STATE_LOCKED] = 'Locked'
STATE_LABELS[NUKI_STATE_UNLOCKED] = 'Unlocked'
STATE_LABELS[NUKI_STATE_UNLATCHED] = 'Unlatched'

const ERROR_LABELS = {}
ERROR_LABELS[ERR_NO_TOKEN] = 'No token - set up in Zepp app'
ERROR_LABELS[ERR_NO_LOCK] = 'No lock picked - set up in Zepp app'
ERROR_LABELS[ERR_AUTH] = 'Token rejected'
ERROR_LABELS[ERR_OFFLINE] = 'Lock/bridge offline'
ERROR_LABELS[ERR_NETWORK] = 'Network error'
ERROR_LABELS[ERR_TIMEOUT] = 'Timed out'

Page({
  state: {},
  build() {
    // Wrapped in try/catch (16.08.2026): the first real-device test
    // showed a plain black screen with nothing on it at all, meaning
    // something threw before/during build() and there's no console
    // access yet (no zeus login -> no bridge/preview) to see what. If
    // this still throws, at least the error message now renders instead
    // of silence - much better than guessing blind between test rounds.
    try {
      this.buildUi()
    } catch (e) {
      hmUI.createWidget(hmUI.widget.TEXT, {
        x: 10,
        y: 10,
        w: DEVICE_WIDTH - 20,
        h: DEVICE_HEIGHT - 20,
        color: 0xff5555,
        text_size: 22,
        text_style: hmUI.text_style.WRAP,
        text: 'build() error:\n' + (e && (e.stack || e.message) || String(e)),
      })
    }
  },

  buildUi() {
    // messageBuilder is read here (page-build time), not at module scope
    // - guaranteed to run after app.js's onCreate() has populated
    // globalData, whereas a top-level read could in principle race it.
    this.messageBuilder = getApp()._options.globalData.messageBuilder

    // Layout tightened (17.08.2026, Jan's screenshot) - the system title
    // bar ("ZeppNuki  17:43") eats some space at the very top that isn't
    // part of DEVICE_HEIGHT's usable area, so the original 260/340/420
    // button stack ran the last button (Unlock) off the bottom edge.
    // Pulled everything up and tightened the gaps.
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 20,
      y: 20,
      w: DEVICE_WIDTH - 40,
      h: 50,
      color: 0xffffff,
      text_size: 32,
      align_h: hmUI.align.CENTER_H,
      text: 'Nuki',
    })

    this.statusText = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 20,
      y: 80,
      w: DEVICE_WIDTH - 40,
      h: 90,
      color: 0xcccccc,
      text_size: 26,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.WRAP,
      text: 'Press Status to check.',
    })

    this.makeButton('Status', 180, () => this.sendStatusRequest())
    this.makeButton('Lock', 254, () => this.sendActionRequest(ACTION_LOCK))
    this.makeButton('Unlock', 328, () => this.sendActionRequest(ACTION_UNLOCK))
  },

  makeButton(label, y, onClick) {
    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: (DEVICE_WIDTH - 300) / 2,
      y: y,
      w: 300,
      h: 64,
      radius: 12,
      normal_color: 0x3a3a3a,
      press_color: 0x555555,
      text_size: 28,
      color: 0xffffff,
      text: label,
      click_func: onClick,
    })
  },

  showText(text) {
    this.statusText.setProperty(hmUI.prop.TEXT, text)
  },

  sendStatusRequest() {
    this.showText('Loading...')
    this.messageBuilder
      .request({ method: METHOD_GET_STATUS })
      .then((res) => this.renderStatusResult(res))
      .catch(() => this.showText('BLE request failed'))
  },

  sendActionRequest(action) {
    this.showText('Sending ' + action + '...')
    this.messageBuilder
      .request({ method: METHOD_ACTION, params: { action: action } })
      .then((res) => {
        // app-side/index.js sends { error } and { result } as SIBLING
        // fields, never error nested inside result - see its own
        // comment. Checking res.result.error here (like a first version
        // of this file did) always missed it, since result was {}
        // and the real error field sat on res.error - showed
        // "Unknown (undefined)" instead of the real error text
        // (Jan's screenshot, 17.08.2026, untouched token/lock setup).
        if (res.error) {
          this.showText(ERROR_LABELS[res.error] || res.error)
          return
        }
        // Command only ACCEPTED so far (concept doc section 2), not
        // necessarily done yet - re-check status right after. Real
        // poll-until-target-state lands in M2.
        this.sendStatusRequest()
      })
      .catch(() => this.showText('BLE request failed'))
  },

  renderStatusResult(res) {
    if (res.error) {
      this.showText(ERROR_LABELS[res.error] || res.error)
      return
    }
    const lock = res.result
    if (!lock) {
      this.showText('No data')
      return
    }
    const stateLabel = STATE_LABELS[lock.state] || 'Unknown (' + lock.state + ')'
    const battery = lock.batteryChargeState != null ? lock.batteryChargeState + '%' : '?'
    this.showText((lock.name || 'Lock') + '\n' + stateLabel + '\nBattery: ' + battery)
  },
})
