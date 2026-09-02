// M1 scope only: plain token + smartlock-ID text fields. The concept doc's
// "Load Locks" dropdown (LIST_LOCKS-driven picker) is explicitly its own
// later milestone (M3), not M1's walking skeleton - until then, Jan
// copies the smartlock ID straight from web.nuki.io's own dashboard.
// View/TextInput/AppSettingsPage/Section are Settings-App globals, no
// import needed - same as every other zeus template's setting/index.js.
//
// Every interactive component (TextInput, Button, ...) must be wrapped in
// Section({}, ...) - that's not optional styling, it's how the Settings
// page's native bridge actually mounts them (see docs.zepp.com's own
// example: Section({}, [Section({}, TextInput({label: 'Name'})), ...])).
// A bare View() with a TextInput inside renders the View's static text
// fine but silently drops the TextInput - confirmed on-device 02.09.2026
// (Jan saw the "Nuki Web API Token"/"Smartlock ID" labels with no input
// box under either).
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

    return Section(
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
        Section(
          {},
          TextInput({
            type: 'password',
            value: this.state.token,
            placeholder: 'from web.nuki.io -> API',
            onChange: (val) => {
              this.state.token = val
              this.state.props.settingsStorage.setItem('nukiToken', val)
            },
          }),
        ),
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
        Section(
          {},
          TextInput({
            value: this.state.smartlockId,
            placeholder: 'numeric ID from the Nuki Web dashboard',
            onChange: (val) => {
              this.state.smartlockId = val
              this.state.props.settingsStorage.setItem('smartlockId', val)
            },
          }),
        ),
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
