// On-watch Settings screen: set the smartlock ID without going through
// the phone's Zepp app Settings page. Needed for sideloaded/Developer
// Mode test installs specifically - those don't get a reachable Settings
// page in the Zepp app at all (a store-installed instance of the same
// app does, but it's a SEPARATE storage from a sideloaded test build),
// so there's no way to get an API token into settingsStorage for a
// sideloaded instance either. That rules out a "Load locks" picker (it
// needs the token to call the Nuki API) - direct numeric entry of an ID
// you already looked up on web.nuki.io is the only path that works
// without a token. The API token itself stays phone-Settings-only (too
// long to type here) - so this screen only ever helps once you're
// testing against a token you set up some other way, or for the
// store-installed instance where the phone Settings page works anyway.
import * as hmUI from '@zos/ui'
import { createKeyboard, inputType } from '@zos/ui'
import { back } from '@zos/router'
import { DEVICE_WIDTH, DEVICE_HEIGHT } from '../utils/config/device'
import { METHOD_SELECT_LOCK } from '../shared/protocol'

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

    this.idText = hmUI.createWidget(hmUI.widget.TEXT, {
      x: 20,
      y: 90,
      w: DEVICE_WIDTH - 40,
      h: 90,
      color: 0xcccccc,
      text_size: 24,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V,
      text_style: hmUI.text_style.WRAP,
      text: 'Smartlock ID:\n(not set)',
    })

    hmUI.createWidget(hmUI.widget.BUTTON, {
      x: (DEVICE_WIDTH - 300) / 2,
      y: 190,
      w: 300,
      h: 56,
      radius: 12,
      normal_color: 0x3a3a3a,
      press_color: 0x555555,
      text_size: 26,
      color: 0xffffff,
      text: 'Set Smartlock ID',
      click_func: () => this.openKeyboard(),
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

  openKeyboard() {
    createKeyboard({
      inputType: inputType.NUM,
      text: '',
      onComplete: (_kb, result) => {
        const id = result && result.data
        if (id) this.saveId(id)
      },
      onCancel: () => {},
    })
  },

  saveId(id) {
    this.idText.setProperty(hmUI.prop.TEXT, 'Saving...')
    this.messageBuilder
      .request({ method: METHOD_SELECT_LOCK, params: { id: id } })
      .then((res) => {
        if (res.error) {
          this.idText.setProperty(hmUI.prop.TEXT, res.error)
          return
        }
        this.idText.setProperty(hmUI.prop.TEXT, 'Smartlock ID:\n' + id)
      })
      .catch(() => this.idText.setProperty(hmUI.prop.TEXT, 'BLE request failed'))
  },
})
