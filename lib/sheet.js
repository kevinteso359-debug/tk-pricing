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
    .replace(/\./g, '')
    .replace(',', '.')
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

  let section = '';
  let updatedAt = '';
  const products = [];

  rows.forEach((row, index) => {
    const trimmed = row.map((cell) => String(cell || '').trim());

    if (!trimmed.some(Boolean)) return;

    const first = trimmed[0];

    // Macro sezioni
    if (first === 'POKEMON') {
      section = 'POKEMON';
      return;
    }
    if (first === 'POKEMON JAP') {
      section = 'POKEMON JAP';
      return;
    }
    if (first === 'POKEMON KOR') {
      section = 'POKEMON KOR';
      return;
    }
    if (first === 'ONE PIECE') {
      section = 'ONE PIECE';
      return;
    }
    if (first === 'DETECTIVE CONAN') {
      section = 'DETECTIVE CONAN';
      return;
    }
    if (first === 'DRAGON BALL') {
      section = 'DRAGON BALL';
      return;
    }

    // Salta intestazioni
    if (first === 'Nome Espansione') return;
    if (first.includes('Notowania giełdowe')) return;

    // Mapping GIUSTO del tuo foglio:
    // A Nome Espansione
    // B Seriale
    // C Box O Case
    // D Trend Prezzo
    // E Prezzo Yen
    // F Prezzo Euro
    // G Prezzo di vendita iva esclusa
    // H Prezzo di vendita Iva Inclusa
    // I Margine
    // J Margine %
    // K Data di agg

    const nomeEspansione = trimmed[0];
    const seriale = trimmed[1];
    const boxOCase = trimmed[2];
    const trendPrezzo = trimmed[3];
    const prezzoYen = trimmed[4];
    const prezzoEuro = trimmed[5];
    const prezzoVenditaIvaEsclusa = trimmed[6];
    const prezzoVenditaIvaInclusa = trimmed[7];
    const margine = trimmed[8];
    const marginePct = trimmed[9];
    const dataAgg = trimmed[10];

    if (!nomeEspansione) return;

    const supplierEur = parseMoney(prezzoEuro);
    const supplierYen = parseMoney(prezzoYen);

    // Se manca il costo euro, salta il prodotto
    if (supplierEur <= 0) return;

    if (!updatedAt && dataAgg) {
      updatedAt = dataAgg;
    }

    const productName = compactJoin([nomeEspansione, seriale, boxOCase]);

    products.push({
      id: buildProductId(productName, index),
      section: section || 'ALTRO',
      name: productName,
      unit: boxOCase || 'Unit',
      stock: '-', // non hai una colonna stock vera in questo foglio
      trend: trendPrezzo || '-',
      yenPrice: supplierYen,
      image: null,
      meta: {
        nomeEspansione,
        seriale,
        boxOCase,
        trendPrezzo,
        prezzoVenditaIvaEsclusa,
        prezzoVenditaIvaInclusa,
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
