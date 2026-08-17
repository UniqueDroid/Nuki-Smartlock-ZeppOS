// M1 "Durchstich" screen (concept doc section 8): button -> Side Service
// -> Nuki API -> response shown on the watch. Deliberately NOT the full
// State Machine from section 3.2 yet (SENDING/PENDING/SUCCESS/ERROR,
// disabled buttons during a pending action, distinct haptics per
// outcome) - that's M2. This just proves the BLE round-trip and the Nuki
// Web API call work end to end.
import * as hmUI from '@zos/ui'
import { DEVICE_WIDTH } from '../utils/config/device'
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

const { messageBuilder } = getApp()._options.globalData

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
    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 20,
      y: 40,
      w: DEVICE_WIDTH - 40,
      h: 60,
      color: 0xffffff,
      text_size: 32,
      align_h: hmUI.align.CENTER_H,
      text: 'Nuki',
    })

    this.statusText = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 20,
      y: 120,
      w: DEVICE_WIDTH - 40,
      h: 120,
      color: 0xcccccc,
      text_size: 26,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.WRAP,
      text: 'Press Status to check.',
    })

    this.makeButton('Status', 260, () => this.sendStatusRequest())
    this.makeButton('Lock', 340, () => this.sendActionRequest(ACTION_LOCK))
    this.makeButton('Unlock', 420, () => this.sendActionRequest(ACTION_UNLOCK))
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
    messageBuilder
      .request({ method: METHOD_GET_STATUS })
      .then((res) => this.renderStatusResult(res))
      .catch(() => this.showText('BLE request failed'))
  },

  sendActionRequest(action) {
    this.showText('Sending ' + action + '...')
    messageBuilder
      .request({ method: METHOD_ACTION, params: { action: action } })
      .then((res) => {
        const { result = {} } = res
        if (result.error) {
          this.showText(ERROR_LABELS[result.error] || result.error)
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
    const { result = {} } = res
    if (result.error) {
      this.showText(ERROR_LABELS[result.error] || result.error)
      return
    }
    const lock = result
    if (!lock) {
      this.showText('No data')
      return
    }
    const stateLabel = STATE_LABELS[lock.state] || 'Unknown (' + lock.state + ')'
    const battery = lock.batteryChargeState != null ? lock.batteryChargeState + '%' : '?'
    this.showText((lock.name || 'Lock') + '\n' + stateLabel + '\nBattery: ' + battery)
  },
})
