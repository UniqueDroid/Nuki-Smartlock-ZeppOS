// On-watch Settings screen: pick a smartlock without going through the
// phone's Zepp app Settings page. Only the smartlock ID lives here - the
// Nuki Web API token is a long secret string, not practical to type with
// 4 buttons/a touchscreen keyboard, so that stays phone-side only (see
// setting/index.js). Reuses METHOD_LIST_LOCKS, which already existed on
// the Side Service for the (until now unbuilt) M3 "Load Locks" picker -
// same backend call, same trimmed {id, name} result, just wired up here.
import * as hmUI from '@zos/ui'
import { back } from '@zos/router'
import { DEVICE_WIDTH, DEVICE_HEIGHT } from '../utils/config/device'
import { METHOD_LIST_LOCKS, METHOD_SELECT_LOCK, ERR_NO_TOKEN } from '../shared/protocol'

const ERROR_LABELS = {}
ERROR_LABELS[ERR_NO_TOKEN] = 'No token yet - set it up in the Zepp app first'

const ROW_H = 66
const LIST_TOP = 160

Page({
  state: {},
  build() {
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
    this.messageBuilder = getApp()._options.globalData.messageBuilder
    this.listWidgets = []

    hmUI.createWidget(hmUI.widget.TEXT, {
      x: 20,
      y: 30,
      w: DEVICE_WIDTH - 40,
      h: 44,
      color: 0xffffff,
      text_size: 30,
      align_h: hmUI.align.CENTER_H,
      text: 'Settings',
    })

    this.statusText = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 20,
      y: 80,
      w: DEVICE_WIDTH - 40,
      h: 60,
      color: 0xcccccc,
      text_size: 22,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.WRAP,
      text: 'Tap "Load locks" to pick your smartlock.',
    })

    this.loadButton = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: (DEVICE_WIDTH - 300) / 2,
      y: 118,
      w: 300,
      h: 56,
      radius: 12,
      normal_color: 0x3a3a3a,
      press_color: 0x555555,
      text_size: 26,
      color: 0xffffff,
      text: 'Load locks',
      click_func: () => this.loadLocks(),
    })

    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: (DEVICE_WIDTH - 300) / 2,
      y: DEVICE_HEIGHT - 84,
      w: 300,
      h: 60,
      radius: 12,
      normal_color: 0x3a3a3a,
      press_color: 0x555555,
      text_size: 26,
      color: 0xffffff,
      text: 'Back',
      click_func: () => back(),
    })
  },

  showStatus(text) {
    this.statusText.setProperty(hmUI.prop.TEXT, text)
  },

  clearList() {
    this.listWidgets.forEach((w) => hmUI.deleteWidget(w))
    this.listWidgets = []
  },

  loadLocks() {
    this.clearList()
    this.showStatus('Loading...')
    this.messageBuilder
      .request({ method: METHOD_LIST_LOCKS })
      .then((res) => this.renderLocks(res))
      .catch(() => this.showStatus('BLE request failed'))
  },

  renderLocks(res) {
    if (res.error) {
      this.showStatus(ERROR_LABELS[res.error] || res.error)
      return
    }
    const locks = res.result || []
    if (!locks.length) {
      this.showStatus('No locks found on this Nuki account.')
      return
    }
    this.showStatus('Tap a lock to select it:')
    locks.forEach((lock, i) => {
      const w = hmUI.createWidget(hmUI.widget.BUTTON, {
        x: (DEVICE_WIDTH - 300) / 2,
        y: LIST_TOP + i * (ROW_H + 8),
        w: 300,
        h: ROW_H,
        radius: 12,
        normal_color: 0x1c2b3a,
        press_color: 0x263f57,
        text_size: 24,
        color: 0xffffff,
        text: lock.name || 'Lock ' + lock.id,
        click_func: () => this.selectLock(lock),
      })
      this.listWidgets.push(w)
    })
  },

  selectLock(lock) {
    this.showStatus('Saving...')
    this.messageBuilder
      .request({ method: METHOD_SELECT_LOCK, params: { id: lock.id } })
      .then((res) => {
        if (res.error) {
          this.showStatus(res.error)
          return
        }
        this.showStatus((lock.name || 'Lock') + ' selected.')
      })
      .catch(() => this.showStatus('BLE request failed'))
  },
})
