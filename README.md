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

Öppna gymskärmen i helskärm, till exempel:

```bash
chromium-browser --kiosk --autoplay-policy=no-user-gesture-required --app=https://trainer.vastervikclimbing.se/display
```

Pi och tränardator måste använda samma **synk-rum** (inställningar). Då följer storskärmen valet i kontrollpanelen.

## Lokalt

```bash
npm install
npm run dev
```

Kontrollpanel: http://localhost:5173/
Gymskärm: http://localhost:5173/display
