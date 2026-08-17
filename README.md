# Nuki-Smartlock-ZeppOS

Nuki Smart Lock von der Amazfit-Uhr aus sperren, entsperren und Status einsehen. Zepp OS Mini App fuer die **Amazfit Bip Max** (Geraetecode `PikeW`, quadratisches Display).

Volles Architektur-Konzept: [`nuki-zeppos-konzept.md`](nuki-zeppos-konzept.md).

## Status: M1 "Durchstich" (16.08.2026)

Erste durchgehende Verdrahtung Uhr -> Side Service -> Nuki Web API -> Antwort auf der Uhr. Noch **nicht getestet gegen einen echten Nuki-Account** (kein Token vorhanden) - Build kompiliert sauber, aber die tatsaechliche API-Antwort (Feldnamen in `trimSmartlock()`, `app-side/index.js`) ist bislang nur gegen die [Nuki-API-Doku](https://developer.nuki.io/) angenommen, nicht verifiziert.

**Naechster Schritt:** Nuki Web API Token (nur Scopes `smartlock.action` + `smartlock.readOnly`, nicht den Vollzugriffs-Token) sowie die Smartlock-ID unter Settings -> Nuki-Smartlock-ZeppOS in der Zepp-App eintragen, dann auf der Uhr "Status" druecken.

## Projektstruktur

```
app.json              # Target "PikeW" (Amazfit Bip Max), apiLevel 3.0
app.js                # MessageBuilder-Verbindung Uhr <-> Side Service
app-side/
  index.js            # Message-Dispatcher (GET_STATUS/ACTION/LIST_LOCKS)
  nuki-web-backend.js  # Variante A: direkter https://api.nuki.io-Client
page/index.js          # Hauptscreen: Status-Text + Status/Lock/Unlock-Buttons
setting/index.js       # Token + Smartlock-ID (Zepp-App-Settings)
shared/protocol.js      # Message-Typen + Fehlercodes, von Uhr UND Side Service importiert
shared/message*.js, event.js, defer.js, ...  # Zepp OS Messaging-Grundgeruest (aus dem offiziellen "Fetch Api"-Template uebernommen)
utils/config/           # Geraete-Breite/Hoehe, Farbkonstanten
```

## Bewusst noch nicht umgesetzt (naechste Meilensteine)

- **M2** - richtige State Machine (SENDING/PENDING/SUCCESS/ERROR), Status-Polling nach einer Aktion, Haptik, gesperrte Buttons waehrend eine Aktion laeuft.
- **M3** - "Locks laden"-Button in den Settings (`LIST_LOCKS`-Dropdown) statt manueller Smartlock-ID-Eingabe.
- **M4** - Icons, Unlatch-Bestaetigungsdialog, i18n.
- **M5** - Variante B (eigener Proxy statt direktem Nuki-Web-API-Zugriff).

## Bauen

```
npm install -g @zeppos/zeus-cli   # falls noch nicht global installiert
zeus build
```

`zeus preview`/`zeus dev` brauchen ein per `zeus login` verbundenes Zepp-Konto + Simulator oder echtes Geraet - hier noch nicht eingerichtet.
