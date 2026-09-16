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

Klona repot (ingen Node-installation behövs — scriptet öppnar den publicerade gymsidan):

```bash
sudo apt update
sudo apt install -y git cec-utils
git clone https://github.com/VKC276/ClimbTraining.git ~/ClimbTraining
chmod +x ~/ClimbTraining/pi/gym-display.sh ~/ClimbTraining/pi/gym-helper.py
~/ClimbTraining/pi/gym-display.sh
```

När koden uppdaterats på GitHub:

```bash
cd ~/ClimbTraining
git pull
```

Autostart:

```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/gym-display.desktop
```

```ini
[Desktop Entry]
Type=Application
Name=Gymskärm
Exec=/home/pi/ClimbTraining/pi/gym-display.sh
X-GNOME-Autostart-enabled=true
```

Byt `/home/pi` om Pi-användaren heter något annat.

Scriptet startar en lokal CEC-hjälpare och öppnar gymsidan i kiosk. Volym och skärm på/av går bara över HDMI-CEC (ingen RS-232/nätverksstyrning).

På testskärmen (t.ex. LG): slå på **SIMPLINK / HDMI-CEC**. Gymskärmen visar ett **skärm-id** nere till höger i vila. Ange samma kod i kontrollpanelen. Under **Inställningar** styrs volym, skärm på/av och schema.

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
