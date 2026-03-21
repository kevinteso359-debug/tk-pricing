import { FALLBACK_PRODUCTS } from './config';

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
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
  if (!raw) return 0;

  const cleaned = String(raw)
    .replace(/S\$/g, '')
    .replace(/A\$/g, '')
    .replace(/[$€¥,\s]/g, '')
    .replace(/[^0-9.-]/g, '');

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function parseRows(csvText) {
  return csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(parseCsvLine);
}

function buildProductId(name, unit, index) {
  return `${name}-${unit}-${index}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function parseSupplierCsv(csvText) {
  const rows = parseRows(csvText);

  let section = '';
  let lastName = '';
  let updatedAt = '';
  let validUntil = '';
  const products = [];

  rows.forEach((row, index) => {
    const trimmed = row.map((cell) => String(cell || '').trim());
    const first = trimmed[0];

    if (!updatedAt) {
      const match = trimmed.find((cell) => cell.startsWith('Updated '));
      if (match) updatedAt = match;
    }

    if (!validUntil) {
      const match = trimmed.find((cell) =>
        cell.startsWith('Prices valid for orders placed until ')
      );
      if (match) validUntil = match;
    }

    if (first === 'Preorder' || first === 'Restock' || first === 'In stock') {
      section = first;
      return;
    }

    if (trimmed[0] === 'Photo' && trimmed[1] === 'name') {
      return;
    }

    const hasUnit = Boolean(trimmed[2]);
    const hasStock = Boolean(trimmed[3]);
    const hasMoney = trimmed.slice(4, 9).some((cell) => parseMoney(cell) > 0);

    if (!hasUnit || (!hasMoney && !hasStock)) {
      return;
    }

    const image = trimmed[0] || null;
    const rawName = trimmed[1];
    const unit = trimmed[2];
    const stock = trimmed[3];

    if (rawName) lastName = rawName;
    const name = rawName || lastName;
    if (!name) return;

    // ✅ PRENDIAMO SOLO JPY (colonna 4)
    const jpy = parseMoney(trimmed[4]);

    const product = {
      id: buildProductId(name, unit, index),
      section: section || 'Other',
      name,
      unit,
      stock,
      image,
      costs: {
        JPY: jpy
      }
    };

    // skip prodotti senza prezzo reale
    if (jpy === 0 && /sold out/i.test(stock)) {
      return;
    }

    products.push(product);
  });

  return {
    updatedAt,
    validUntil,
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
