// M1 scope only: plain token + smartlock-ID text fields. The concept doc's
// "Load Locks" dropdown (LIST_LOCKS-driven picker) is explicitly its own
// later milestone (M3), not M1's walking skeleton - until then, Jan
// copies the smartlock ID straight from web.nuki.io's own dashboard.
// View/TextInput/AppSettingsPage are Settings-App globals, no import
// needed - same as every other zeus template's setting/index.js.
AppSettingsPage({
  state: {
    props: {},
    token: '',
    smartlockId: '',
  },
  setState(props) {
    this.state.props = props
    this.state.token = props.settingsStorage.getItem('nukiToken') || ''
    this.state.smartlockId = props.settingsStorage.getItem('smartlockId') || ''
  },
  build(props) {
    this.setState(props)

    return View(
      {
        style: {
          padding: '12px',
        },
      },
      [
        View(
          {
            style: {
              fontSize: '14px',
              fontWeight: 'bold',
              marginBottom: '6px',
            },
          },
          ['Nuki Web API Token'],
        ),
        TextInput({
          type: 'password',
          value: this.state.token,
          placeholder: 'from web.nuki.io -> API',
          onChange: (val) => {
            this.state.token = val
            this.state.props.settingsStorage.setItem('nukiToken', val)
          },
        }),
        View(
          {
            style: {
              fontSize: '14px',
              fontWeight: 'bold',
              marginTop: '18px',
              marginBottom: '6px',
            },
          },
          ['Smartlock ID'],
        ),
        TextInput({
          value: this.state.smartlockId,
          placeholder: 'numeric ID from the Nuki Web dashboard',
          onChange: (val) => {
            this.state.smartlockId = val
            this.state.props.settingsStorage.setItem('smartlockId', val)
          },
        }),
        View(
          {
            style: {
              fontSize: '11px',
              color: '#888',
              marginTop: '18px',
            },
          },
          [
            'Create the token in Nuki Web with only the scopes this app ' +
              'needs (smartlock.action, smartlock.readOnly) - not the ' +
              'full-access token.',
          ],
        ),
      ],
    )
  },
})
