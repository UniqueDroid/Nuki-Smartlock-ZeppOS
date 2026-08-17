# Konzept: Nuki Mini App für Zepp OS

**Arbeitstitel:** ZeppNuki
**Ziel:** Nuki Smart Lock von der Amazfit-Uhr aus sperren, entsperren und Status einsehen – ohne das Handy aus der Tasche zu nehmen.
**Zielplattform:** Zepp OS 3.0+ (API Level 3.0), abwärtskompatibel bis 2.0 möglich, aber nicht primäres Ziel.

---

## 1. Überblick

Zepp OS Mini Apps bestehen aus drei Bausteinen, die alle in diesem Projekt gebraucht werden:

| Baustein | Läuft auf | Aufgabe hier |
|---|---|---|
| **Device App** | Uhr | UI, Lock/Unlock auslösen, Status anzeigen |
| **Side Service** | Zepp-App (Handy) | HTTP-Calls zur Nuki Web API via `fetch()` |
| **Settings App** | Zepp-App (Handy) | API-Token, Smartlock-Auswahl, Optionen |

Die Uhr selbst hat keinen freien Internetzugang und keine nutzbare BLE-Central-API für Drittanbieter – **alle Nuki-Kommunikation läuft zwingend über den Side Service auf dem Handy.** Das ist die zentrale Architektur-Randbedingung.

```
┌─────────────────────┐   BLE (MessageBuilder /    ┌──────────────────────┐
│  Device App (Uhr)    │   @zeppos/zml BaseSideSvc) │  Side Service (Handy) │
│  - UI / Statecharts  │ ◄────────────────────────► │  - fetch() → Nuki API │
│  - Haptik/Feedback   │                            │  - Token aus Settings │
└─────────────────────┘                            └──────────┬───────────┘
                                                              │ HTTPS
                                                              ▼
                                                   api.nuki.io  (Variante A)
                                                   eigener Proxy (Variante B)
                                                              │
                                                              ▼
                                              Nuki Bridge / SL Pro WiFi → Smart Lock
```

---

## 2. Backend-Varianten

### Variante A – Nuki Web API direkt (MVP)

- Side Service ruft `https://api.nuki.io` direkt mit Bearer-Token auf.
- Token wird in Nuki Web (web.nuki.io → API) generiert und in der Settings App hinterlegt.
- Relevante Endpunkte:
  - `GET /smartlock` – Liste aller Locks (für die Geräteauswahl in den Settings)
  - `GET /smartlock/{id}` – Status (Lock-State, Batterie, Türsensor)
  - `POST /smartlock/{id}/action/lock`
  - `POST /smartlock/{id}/action/unlock`
  - `POST /smartlock/{id}/action` mit `{"action": 3}` für Unlatch (Falle ziehen)
- Antwort auf Actions ist `204 No Content` – der Befehl ist damit nur *angenommen*, nicht ausgeführt. Der tatsächliche Zustand muss per Polling auf `GET /smartlock/{id}` nachgezogen werden.

**Pro:** Kein eigener Serverbetrieb, funktioniert überall.
**Contra:** Token hat volle Kontorechte; Cloud-Abhängigkeit; Latenz 2–5 s.

### Variante B – Eigener Proxy (Ausbaustufe, passt zu deinem Setup)

Kleiner Dienst auf dem Proxmox-Host (LXC, z. B. Node/Fastify oder Python/FastAPI), der nur drei Endpunkte exponiert:

```
POST /lock      POST /unlock      GET /status
```

- Auth per eigenem, eng gefasstem Token (oder mTLS), Nuki-Token bleibt serverseitig.
- Der Proxy kann wahlweise die Web API **oder** die lokale Bridge-API (`http://<bridge>:8080/lockAction?...`) ansprechen – Bridge-Variante spart den Cloud-Roundtrip, wenn der Server eh im Heimnetz steht.
- Erreichbarkeit von unterwegs über das, was du ohnehin hast (WireGuard/Tailscale auf dem Handy, oder Reverse Proxy mit Auth).
- Bonus: Rate-Limiting, Audit-Log, „Panic-Kill-Switch" zentral an einer Stelle.

**Empfehlung:** MVP mit Variante A bauen, die Side-Service-HTTP-Schicht aber so abstrahieren (ein `NukiBackend`-Interface), dass Variante B ein reiner Konfigurationswechsel ist (Base-URL + Auth-Header in den Settings).

---

## 3. Device App (Uhr)

### 3.1 Screens

**Hauptscreen (Single-Screen-Design):**

```
        ┌────────────────┐
        │   Wohnungstür   │   ← Lock-Name (aus Settings)
        │                │
        │      🔒         │   ← großes Status-Icon
        │   VERRIEGELT    │   ← Klartext-Status
        │   🔋 78 %       │   ← Batterie Lock
        │                │
        │ [🔓 Auf] [🔒 Zu] │   ← Buttons, min. 48 px Touch-Target
        │   (Unlatch ⤵)   │   ← optional, per Long-Press oder Swipe
        └────────────────┘
```

- Rundes und eckiges Display berücksichtigen (`getDeviceInfo()` → width/height, Layout relativ).
- Bei mehreren Locks: horizontaler Swipe zwischen Locks (Ausbaustufe; MVP = ein Lock).

**Unlatch (Falle ziehen)** ist die gefährlichste Aktion (Tür ist danach wirklich offen) → bewusst schwerer erreichbar machen: Long-Press auf „Auf" oder separater Bestätigungsdialog.

### 3.2 State Machine

Der UI-Zustand ist das Herzstück – schlechtes Feedback ist bei 2–5 s Latenz der Killer.

```
IDLE ──(Button)──► SENDING ──(Side Svc ACK)──► PENDING ──(Poll: Zielzustand)──► SUCCESS ─(2 s)─► IDLE
  ▲                    │                          │
  │                    │ Timeout 10 s             │ Timeout 30 s / Fehlerstatus
  └──── ERROR ◄────────┴──────────────────────────┘
        (Retry-Button, Fehlertext)
```

- **SENDING:** Spinner + Vibration kurz (Befehl raus).
- **PENDING:** „Wird entriegelt…", Buttons gesperrt (Doppel-Trigger verhindern).
- **SUCCESS:** Haptisches Feedback (unterschiedliches Muster für auf/zu), Icon-Wechsel.
- **ERROR:** Klartext („Bridge offline", „Timeout", „Token ungültig") + Retry.
- Beim App-Start: sofort Status-Request, bis dahin letzter bekannter Zustand ausgegraut mit Zeitstempel („zuletzt: vor 3 min").

### 3.3 Nuki Lock-States (Mapping)

| Nuki `state` | Anzeige | Farbe |
|---|---|---|
| 1 locked | Verriegelt | grün |
| 3 unlocked | Entriegelt | orange |
| 5 unlatched | Falle offen | rot |
| 2/4/7 (in Bewegung) | Arbeitet… | grau |
| 254/255 motor blocked / undefined | Fehler | rot |

Türsensor (falls vorhanden, `doorState`): Tür offen/zu als kleines Zusatz-Icon – verhindert den Klassiker „verriegelt bei offener Tür".

---

## 4. Side Service (Handy)

### 4.1 Aufgaben

- Nachrichten von der Uhr entgegennehmen (`@zeppos/zml` `BaseSideService` oder klassischer MessageBuilder).
- Request-Typen:

```js
{ type: "GET_STATUS" }
{ type: "ACTION", action: "lock" | "unlock" | "unlatch" }
{ type: "LIST_LOCKS" }        // nur für Settings-Sync
```

- Antworten immer mit `requestId` korrelieren (Uhr kann mehrere Requests offen haben, z. B. Status-Poll parallel zu Action).
- Nach einer Action: serverseitig 3× im Abstand von 2 s den Status pollen und der Uhr Zwischenstände pushen (`call`/`onCall`), statt die Uhr pollen zu lassen – spart BLE-Roundtrips und Akku.

### 4.2 Fehlerbehandlung

| Fehlerquelle | Erkennung | Meldung an Uhr |
|---|---|---|
| Kein Token konfiguriert | Settings leer | `ERR_NO_TOKEN` → Uhr zeigt „Setup in Zepp-App" |
| HTTP 401 | Response-Code | `ERR_AUTH` |
| HTTP 503 / Bridge offline | Response-Code / `serverState != 0` | `ERR_OFFLINE` |
| Kein Netz am Handy | fetch wirft | `ERR_NETWORK` |
| Timeout | eigener Timer (8 s) | `ERR_TIMEOUT` |

### 4.3 Bekannte Plattform-Fallstricke

- **Side Service lebt nur mit der Zepp-App.** Auf Android: Nutzer-Hinweis in den Settings, die Zepp-App vom Battery-Optimizer auszunehmen. Das Problem ist nicht wegzuentwickeln, nur zu dokumentieren.
- `fetch()` im Side Service hat je nach Zepp-App-Version Eigenheiten (Header-Handling, Timeout nicht nativ) → eigenen Timeout via `Promise.race` bauen.
- Payload-Größe über BLE klein halten: Status-Antwort auf die 5–6 benötigten Felder eindampfen, nicht das rohe Nuki-JSON durchreichen.

---

## 5. Settings App

Formular in der Zepp-App:

1. **Backend-Modus:** „Nuki Web API" / „Eigener Server" (Ausbaustufe)
2. **API-Token** (Passwortfeld) bzw. Base-URL + Token bei Variante B
3. **Button „Locks laden"** → `LIST_LOCKS` → Dropdown zur Auswahl des Smartlocks (speichert `smartlockId` + Name)
4. **Optionen:**
   - Unlatch-Button anzeigen (default: aus)
   - Bestätigung vor Unlock (default: an)
   - Status-Polling-Intervall bei geöffneter App (default: 30 s)

Speicherung im `settingsStorage`; der Side Service liest daraus. Token wird nie an die Uhr übertragen – die Uhr kennt nur abstrakte Kommandos.

---

## 6. Sicherheit

- **Token-Scope:** Der Nuki-Web-Token kann kontoweit alles. Deshalb: in Nuki Web einen Token nur mit den nötigen Scopes anlegen (`smartlock.action`, `smartlock.readOnly`), nicht den Vollzugriffs-Token.
- **Kein Token auf der Uhr:** Kommandos von der Uhr sind semantisch („unlock"), nie Credentials. Verlust/Diebstahl der Uhr allein reicht damit nicht – aber:
- **Uhr = Schlüssel:** Wer die entsperrte Uhr hat, kann die Tür öffnen. Option „Bestätigung vor Unlock" (Wisch-Geste oder Doppel-Tap) als Default; ggf. später an das Wrist-Detection-/Unlock-Verhalten der Uhr koppeln, sofern API vorhanden.
- **Variante B** reduziert die Angriffsfläche weiter: kompromittiertes Handy kennt nur den eingeschränkten Proxy-Token, Nuki-Zugang bleibt auf dem Server.
- Logging im Side Service ohne Token/IDs im Klartext.

---

## 7. Projektstruktur

```
zepp-nuki/
├── app.json                  # targets je Gerät, permissions: data:os.device.info etc.
├── app-side/
│   ├── index.js              # BaseSideService, Message-Dispatcher
│   ├── nuki-web-backend.js   # Variante A
│   ├── proxy-backend.js      # Variante B (später)
│   └── backend.js            # gemeinsames Interface + Auswahl aus Settings
├── setting/
│   └── index.js              # Settings-UI
├── page/
│   ├── index.js              # Hauptscreen + State Machine
│   └── i18n/                 # de/en
├── shared/
│   └── protocol.js           # Message-Typen, Fehlercodes (eine Quelle der Wahrheit)
└── assets/<screen-type>/     # Icons: lock/unlock/unlatch/error/battery
```

Toolchain: `zeus` CLI (Zepp OS CLI), Simulator für UI-Iteration, echtes Gerät für BLE-/Side-Service-Tests (der Simulator verhält sich beim Messaging nicht 1:1 wie das reale Setup).

---

## 8. Meilensteine

| # | Meilenstein | Inhalt | Aufwand (grob) |
|---|---|---|---|
| M1 | Durchstich | ToDo-List-Sample als Basis; Button auf Uhr → Side Service → `GET /smartlock` → Antwort auf Uhr anzeigen | 1 Abend |
| M2 | MVP | Lock/Unlock, State Machine, Status-Polling nach Action, Fehlertexte | 2–3 Abende |
| M3 | Settings | Token-Eingabe, Lock-Auswahl via `LIST_LOCKS`, Optionen | 1–2 Abende |
| M4 | Polish | Haptik, Icons, rund/eckig-Layouts, i18n, Unlatch mit Bestätigung | 1–2 Abende |
| M5 | Variante B | Proxy auf Proxmox (FastAPI/Fastify), Backend-Umschalter | 1–2 Abende |
| M6 | Nice-to-have | Multi-Lock-Swipe, Türsensor-Anzeige, Shortcut/Widget (falls vom Gerät unterstützt), Komplikation | offen |

---

## 9. Offene Punkte / Risiken

- **Gerätewahl:** API-Level und Widget-/Shortcut-Fähigkeiten unterscheiden sich je Uhr – vor M1 festlegen, welches Gerät primäres Target ist (bestimmt `app.json` targets und Layout-Presets).
- **Nuki-Konto-Voraussetzungen:** Web API setzt voraus, dass das Lock mit Nuki Web verbunden ist (Bridge oder SL Pro mit WLAN). Bei neueren Nuki-Tarifmodellen prüfen, ob API-Zugriff an ein Abo gebunden ist – das hat sich in der Vergangenheit geändert.
- **Zepp-Store-Veröffentlichung** (optional): Review-Prozess und Richtlinien prüfen, falls die App nicht nur per Sideload/Dev-Modus laufen soll.
- **BLE-Direktverbindung Uhr → Nuki:** bewusst außerhalb des Scopes (keine Public-BLE-Central-API, Nuki-Protokoll bräuchte NaCl-Crypto auf der Uhr).
