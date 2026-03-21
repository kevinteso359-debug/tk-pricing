import { FALLBACK_PRODUCTS } from './config';

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function parseMoney(raw) {
  if (raw == null) return 0;

  const text = String(raw).trim();
  if (!text || text === '#ARG!') return 0;

  const cleaned = text
    .replace(/S\$/g, '')
    .replace(/A\$/g, '')
    .replace(/[€¥$,]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^0-9.-]/g, '');

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function parseRows(csvText) {
  return csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(parseCsvLine);
}

function buildProductId(name, index) {
  return `${name}-${index}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function compactJoin(parts) {
  return parts
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
}

export function parseSupplierCsv(csvText) {
  const rows = parseRows(csvText);

  let section = 'POKEMON';
  let updatedAt = '';
  const products = [];

  rows.forEach((row, index) => {
    const trimmed = row.map((cell) => String(cell || '').trim());

    // Rileva macro-sezioni dal foglio
    if (trimmed[0] === 'POKEMON JAP') section = 'POKEMON JAP';
    if (trimmed[0] === 'POKEMON KOR') section = 'POKEMON KOR';
    if (trimmed[0] === 'ONE PIECE') section = 'ONE PIECE';
    if (trimmed[0] === 'DETECTIVE CONAN') section = 'DETECTIVE CONAN';
    if (trimmed[0] === 'DRAGON BALL') section = 'DRAGON BALL';

    // Salta righe vuote
    if (!trimmed.some(Boolean)) return;

    // Salta intestazioni
    if (trimmed[0] === 'POKEMON') return;
    if (trimmed[0] === 'Nome' || trimmed[0].includes('Nome Espansione')) return;
    if (trimmed[0] === 'Notowania giełdowe non coprono tutti i mercati e possono essere in ritardo fino a 20 minuti.') return;

    // Nel tuo foglio:
    // A Nome
    // B Espansione
    // C Seriale
    // D Box O Case
    // E Trend
    // F Prezzo
    // G Prezzo Yen
    // H Prezzo Euro
    // I Prezzo di vendita iva esclusa
    // J Prezzo di vendita Iva Inclusa
    // K Margine
    // L Margine %
    // M Data di agg

    const nome = trimmed[0];
    const espansione = trimmed[1];
    const seriale = trimmed[2];
    const tipo = trimmed[3];
    const trend = trimmed[4];
    const prezzoLabel = trimmed[5];
    const prezzoYen = trimmed[6];
    const prezzoEuro = trimmed[7];
    const prezzoVenditaNetto = trimmed[8];
    const prezzoVenditaIvato = trimmed[9];
    const margine = trimmed[10];
    const marginePct = trimmed[11];
    const dataAgg = trimmed[12];

    // Escludi righe non prodotto
    if (!nome) return;

    const supplierEur = parseMoney(prezzoEuro);
    const supplierYen = parseMoney(prezzoYen);

    // Se non c'è almeno un prezzo valido, ignora
    if (supplierEur <= 0 && supplierYen <= 0) return;

    const productName = compactJoin([nome, espansione, seriale, tipo]);

    if (!updatedAt && dataAgg) {
      updatedAt = dataAgg;
    }

    products.push({
      id: buildProductId(productName, index),
      section,
      name: productName,
      unit: tipo || 'Unit',
      stock: trend || '-',
      image: null,
      meta: {
        nome,
        espansione,
        seriale,
        tipo,
        trend,
        prezzoLabel,
        prezzoVenditaNetto,
        prezzoVenditaIvato,
        margine,
        marginePct,
        dataAgg
      },
      costs: {
        EUR: supplierEur,
        JPY: supplierYen
      }
    });
  });

  return {
    updatedAt: updatedAt ? `Aggiornamento foglio: ${updatedAt}` : '',
    validUntil: '',
    products: products.length ? products : FALLBACK_PRODUCTS,
    usedFallback: products.length === 0
  };
}

export function fallbackSupplierData() {
  return {
    updatedAt: 'Fallback demo data',
    validUntil: '',
    products: FALLBACK_PRODUCTS,
    usedFallback: true
  };
}
