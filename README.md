# TKCollectibles Platform Pricing

Mini web app interna per calcolare automaticamente il prezzo consigliato per ogni piattaforma partendo dal listino del fornitore.

## Cosa fa

- legge il Google Sheet del fornitore
- usa il costo fornitore come base (EUR di default)
- aggiunge costi interni per pezzo (shipping inbound, packaging, extra)
- applica fee diverse per eBay, Cardmarket, Shopify e vendita diretta
- calcola prezzo finale, utile stimato e margine
- permette export CSV dei risultati filtrati
- salva le tue fee nel browser

## Feed attuale

Il progetto è già puntato a questo Google Sheet pubblico:

- Sheet ID: `1ogdEGyH8fzrVbqrMcNDuHVjk9cE32XDKN5TOWX8D2Ak`
- GID: `0`

Se un domani cambi fornitore, modifica `lib/config.js`.

## Avvio locale

```bash
npm install
npm run dev
```

Apri `http://localhost:3000`

## Deploy su Vercel

1. carica questa cartella su GitHub
2. importa il repo su Vercel
3. deploy

Non servono environment variables per la versione base.

## File importanti

- `app/page.js` → pagina principale
- `app/api/supplier-feed/route.js` → proxy server-side del Google Sheet
- `lib/sheet.js` → parser del CSV del fornitore
- `lib/pricing.js` → formule di pricing e fee

## Note

- se Google Sheet non risponde, l'app usa alcuni prodotti demo di fallback
- la formula è volutamente semplice e modificabile: puoi adattarla ai tuoi costi reali piattaforma per piattaforma
