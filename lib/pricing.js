export const DEFAULT_GLOBAL_SETTINGS = {
  sourceCurrency: 'EUR',
  vatRate: 0.22,
  inboundShipping: 0,
  packaging: 0.5,
  misc: 0,
  realShippingCostExVat: 4.36
};

export const DEFAULT_PLATFORMS = [
  {
    key: 'ebay',
    name: 'eBay',
    feePct: 0.1435,
    paymentPct: 0,
    fixedFee: 0.35,
    customerShippingInclVat: 6.49,
    targetMode: 'percent', // percent | euro
    targetMarginPct: 0.15,
    targetMarginEur: 10,
    roundStep: 1,
    ending: 0.99
  },
  {
    key: 'cardmarket',
    name: 'Cardmarket',
    feePct: 0.05,
    paymentPct: 0.02,
    fixedFee: 0,
    customerShippingInclVat: 5.5,
    targetMode: 'percent',
    targetMarginPct: 0.18,
    targetMarginEur: 10,
    roundStep: 1,
    ending: 0.99
  },
  {
    key: 'shopify',
    name: 'Shopify',
    feePct: 0.02,
    paymentPct: 0.029,
    fixedFee: 0.25,
    customerShippingInclVat: 7.5,
    targetMode: 'percent',
    targetMarginPct: 0.16,
    targetMarginEur: 10,
    roundStep: 1,
    ending: 0.99
  },
  {
    key: 'direct',
    name: 'Diretto',
    feePct: 0,
    paymentPct: 0,
    fixedFee: 0,
    customerShippingInclVat: 6.5,
    targetMode: 'percent',
    targetMarginPct: 0.12,
    targetMarginEur: 10,
    roundStep: 1,
    ending: 0.99
  }
];

export function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function getSourceCostEur(product) {
  return toNumber(product?.costs?.EUR);
}

export function getLandedCostEur(product, settings) {
  return (
    getSourceCostEur(product) +
    toNumber(settings?.inboundShipping) +
    toNumber(settings?.packaging) +
    toNumber(settings?.misc)
  );
}

export function roundUpWithEnding(value, step = 1, ending = 0.99) {
  if (!Number.isFinite(value) || value <= 0) return 0;

  const safeStep = step > 0 ? step : 1;
  const floored = Math.floor(value / safeStep) * safeStep;
  let candidate = floored + ending;

  if (candidate < value) candidate += safeStep;

  return Number(candidate.toFixed(2));
}

function getTargetProfitEur(landedCost, platform) {
  const mode = platform?.targetMode || 'percent';

  if (mode === 'euro') {
    return toNumber(platform?.targetMarginEur);
  }

  return landedCost * toNumber(platform?.targetMarginPct);
}

/*
Obiettivo:
trovare il prezzo ARTICOLO IVA inclusa da pubblicare tale che il NETTO REALE
dopo fee, spedizione reale e landed lasci il margine desiderato.

Fee % calcolate su:
(prezzo articolo IVA incl. + spedizione cliente IVA incl.)

Formule:
T = prezzo articolo IVA incl.
S = spedizione cliente IVA incl.
v = IVA
p = fee %
f = fee fissa
L = landed
R = spedizione reale ex VAT
target = utile desiderato

Netto reale prima di landed/spedizione:
((T + S) / (1+v)) - ((T + S) * p) - f

Vogliamo:
profit = nettoRealePrimaCosti - L - R = target

Da cui:
T = [ (target + L + R + f + S*p)*(1+v) ] / [1 - p*(1+v)] - S
*/
export function computePlatformPrice(landedCost, platform, settings = DEFAULT_GLOBAL_SETTINGS) {
  const feePct = toNumber(platform?.feePct);
  const paymentPct = toNumber(platform?.paymentPct);
  const percentFees = feePct + paymentPct;

  const fixedFee = toNumber(platform?.fixedFee);
  const customerShippingInclVat = toNumber(platform?.customerShippingInclVat);
  const vatRate = toNumber(settings?.vatRate);
  const realShippingCostExVat = toNumber(settings?.realShippingCostExVat);

  const targetProfit = getTargetProfitEur(landedCost, platform);

  const denominator = 1 - percentFees * (1 + vatRate);

  if (denominator <= 0) {
    return {
      salePrice: 0,
      salePriceExVat: 0,
      vatAmount: 0,
      feesAmount: 0,
      netReal: 0,
      profit: 0,
      marginPct: 0,
      markupOnLandedPct: 0,
      targetProfit,
      targetMode: platform?.targetMode || 'percent'
    };
  }

  const numerator =
    (targetProfit + landedCost + realShippingCostExVat + fixedFee + customerShippingInclVat * percentFees) *
      (1 + vatRate);

  const rawSalePrice = numerator / denominator - customerShippingInclVat;

  const salePrice = roundUpWithEnding(
    rawSalePrice,
    toNumber(platform?.roundStep),
    toNumber(platform?.ending)
  );

  const totalCustomerInclVat = salePrice + customerShippingInclVat;
  const totalCustomerExVat = totalCustomerInclVat / (1 + vatRate);

  const salePriceExVat = salePrice / (1 + vatRate);
  const vatAmount = salePrice - salePriceExVat;

  const feesAmount = totalCustomerInclVat * percentFees + fixedFee;

  const netReal = totalCustomerExVat - feesAmount - realShippingCostExVat;
  const profit = netReal - landedCost;
  const marginPct = salePrice > 0 ? profit / salePrice : 0;
  const markupOnLandedPct = landedCost > 0 ? profit / landedCost : 0;

  return {
    salePrice,            // prezzo articolo IVA incl.
    salePriceExVat,       // imponibile articolo
    vatAmount,            // IVA articolo
    feesAmount,           // fee totali sul totale incassato
    netReal,              // netto reale prima del landed
    profit,               // utile reale finale
    marginPct,            // profit / prezzo articolo IVA incl.
    markupOnLandedPct,    // profit / landed
    targetProfit,
    targetMode: platform?.targetMode || 'percent',
    customerShippingInclVat,
    totalCustomerInclVat
  };
}

export function formatCurrency(value, currency = 'EUR') {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(toNumber(value));
}

export function formatPercent(value) {
  return `${(toNumber(value) * 100).toFixed(1)}%`;
}

export function sanitizeForCsv(text) {
  const value = String(text ?? '');

  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}
