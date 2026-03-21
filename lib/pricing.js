export const DEFAULT_GLOBAL_SETTINGS = {
  sourceCurrency: 'EUR',
  vatRate: 0.22,
  inboundShipping: 2.7,
  packaging: 0.5,
  misc: 0
};

export const DEFAULT_PLATFORMS = [
  {
    key: 'ebay',
    name: 'eBay',
    feePct: 0.1435,
    paymentPct: 0,
    fixedFee: 0.35,
    targetMarginPct: 0.22,
    shippingSubsidy: 0,
    roundStep: 1,
    ending: 0.99
  },
  {
    key: 'cardmarket',
    name: 'Cardmarket',
    feePct: 0.05,
    paymentPct: 0.02,
    fixedFee: 0,
    targetMarginPct: 0.18,
    shippingSubsidy: 0,
    roundStep: 1,
    ending: 0.99
  },
  {
    key: 'shopify',
    name: 'Shopify',
    feePct: 0.02,
    paymentPct: 0.029,
    fixedFee: 0.25,
    targetMarginPct: 0.16,
    shippingSubsidy: 0,
    roundStep: 1,
    ending: 0.99
  },
  {
    key: 'direct',
    name: 'Diretto',
    feePct: 0,
    paymentPct: 0,
    fixedFee: 0,
    targetMarginPct: 0.12,
    shippingSubsidy: 0,
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

  if (candidate < value) {
    candidate += safeStep;
  }

  return Number(candidate.toFixed(2));
}

export function computePlatformPrice(landedCost, platform, settings = DEFAULT_GLOBAL_SETTINGS) {
  const feePct = toNumber(platform?.feePct);
  const paymentPct = toNumber(platform?.paymentPct);
  const percentFees = feePct + paymentPct;

  const fixedFees = toNumber(platform?.fixedFee) + toNumber(platform?.shippingSubsidy);
  const targetMarginPct = toNumber(platform?.targetMarginPct);
  const vatRate = toNumber(settings?.vatRate);

  // Margine desiderato sul costo landed
  const desiredNet = landedCost * (1 + targetMarginPct);

  // Prezzo lordo IVA incluso da pubblicare
  // Ricavo netto reale = imponibile - fee percentuali sul lordo - fee fisse
  // imponibile = gross / (1 + IVA)
  // quindi:
  // gross / (1 + IVA) - gross * percentFees - fixedFees = desiredNet
  const denominator = (1 / (1 + vatRate)) - percentFees;

  if (denominator <= 0) {
    return {
      salePrice: 0,
      salePriceExVat: 0,
      vatAmount: 0,
      feesAmount: 0,
      profit: 0,
      marginPct: 0,
      percentFees
    };
  }

  const rawGrossPrice = (desiredNet + fixedFees) / denominator;

  const salePrice = roundUpWithEnding(
    rawGrossPrice,
    toNumber(platform?.roundStep),
    toNumber(platform?.ending)
  );

  const salePriceExVat = salePrice / (1 + vatRate);
  const vatAmount = salePrice - salePriceExVat;
  const feesAmount = salePrice * percentFees + fixedFees;
  const netAfterVatAndFees = salePriceExVat - feesAmount;
  const profit = netAfterVatAndFees - landedCost;
  const marginPct = salePrice > 0 ? profit / salePrice : 0;

  return {
    salePrice,          // PREZZO FINALE IVA INCLUSA
    salePriceExVat,     // imponibile
    vatAmount,          // quota IVA
    feesAmount,         // fee totali piattaforma
    profit,             // utile netto stimato
    marginPct,
    percentFees
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
