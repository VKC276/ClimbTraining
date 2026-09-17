# Västervik Climbing — träningsskärm

Webbsida för storskärmen i hallen (Raspberry Pi) och tränarens kontrollpanel. Sidorna byggs som en statisk app och publiceras via GitHub Pages.

## Adresser

| Vy | Adress |
| --- | --- |
| Kontrollpanel | https://trainer.vastervikclimbing.se/ |
| Gymskärm (Pi) | https://trainer.vastervikclimbing.se/display |
| Inställningar | https://trainer.vastervikclimbing.se/installningar |

I vila visas loggan och en analog eller digital klocka. När ett träningsmoment körs visas en digital klocka uppe till höger. Efter vald tid utan aktivitet på skärmen, eller när tränaren lämnat passet, går visningen tillbaka till vila.

Byt ut `public/logo.svg` mot föreningens riktiga logga när ni har en fil redo.

## GitHub Pages

Workflown i `.github/workflows/pages.yml` bygger från `main` och publicerar via GitHub Actions.

1. **Settings → Pages → Source:** GitHub Actions.
2. Custom domain: `trainer.vastervikclimbing.se` och **Enforce HTTPS**.
3. DNS: CNAME `trainer` → `vkc276.github.io`.

## Raspberry Pi

Ett kommando installerar paket, klonar (eller uppdaterar) repot, sätter autostart och skrivbordets autologin:

```bash
curl -fsSL https://raw.githubusercontent.com/VKC276/ClimbTraining/main/pi/install.sh | bash
```

Starta om när den är klar: `sudo reboot`

Uppdatera senare med samma kommando, eller `bash ~/ClimbTraining/pi/install.sh`.

Logg: `cat ~/.vvk-gym-display.log`

### Närvarosensor (ESP32-WROOM-32)

Valfritt: en ESP32 DevKit C på USB tänder TV:n via CEC när någon är vid skärmen. Gymskärmens helper läser CSI-strömmen automatiskt om kortet sitter i.

1. Öppna `csi-presence-sensor/firmware/csi_presence_sensor/csi_presence_sensor.ino` i Arduino IDE (kort: ESP32 Dev Module). Kopiera `config.example.h` till `config.h` och fyll i hallens WiFi, sen Upload. Router-IP kommer via DHCP.
2. Flytta USB-kabeln till Pi:n. Kör om `pi/install.sh` så användaren är i `dialout`, starta om.
3. Kalibrera i Pi Connect:

```bash
~/ClimbTraining/pi/csi-tune.sh          # status och avstånd till tröskel
~/ClimbTraining/pi/csi-tune.sh watch    # live
~/ClimbTraining/pi/csi-tune.sh 2.5      # lägre = känsligare
~/ClimbTraining/pi/csi-tune.sh hold 10  # släck efter 10 min stillhet
```

Schema släcker fortfarande vid sluttid. Inom öppettid tänds TV:n först när sensorn ser rörelse. Strömknappen på kontrollpanelen går före.

## Lokalt

```bash
npm install
npm run dev
```

Gymskärm: http://localhost:5173/display
Kontrollpanel: http://localhost:5173/

## Synk

Mobil och Pi pratar via Cloudflare Worker (`sync-worker`). Varje gymskärm får ett eget unikt id.

```bash
npx wrangler login
npm run deploy:sync
```

Uppdatera `defaultSyncUrl` i `src/gym/sync.ts` om Workers-adressen skiljer sig, och pusha `main` så Pages bygger om.
