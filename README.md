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

TV:n styrs med HDMI-CEC från kontrollpanelen och valfritt schema under Inställningar.

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
