export const DEFAULT_GLOBAL_SETTINGS = {
  sourceCurrency: 'EUR',
  fxJpyToEur: 0.0062,
  fxUsdToEur: 0.92,
  fxSgdToEur: 0.69,
  fxAudToEur: 0.60,
  inboundShipping: 4.5,
  packaging: 0.8,
  misc: 0
};

export const DEFAULT_PLATFORMS = [
  {
    key: 'ebay',
    name: 'eBay',
    feePct: 0.115,
    paymentPct: 0.03,
    fixedFee: 0.35,
    targetMarginPct: 0.22,
    shippingSubsidy: 0,
    roundStep: 1,
    ending: 0.9
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
    ending: 0.9
  },
  {
    key: 'shopify',
    name: 'Shopify',
    feePct: 0.02,
    paymentPct: 0.014,
    fixedFee: 0.25,
    targetMarginPct: 0.16,
    shippingSubsidy: 0,
    roundStep: 1,
    ending: 0.9
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
    ending: 0.9
  }
];

export function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function getSourceCostEur(product, settings) {
  const currency = settings.sourceCurrency;

  if (currency === 'EUR') return toNumber(product?.costs?.EUR);
  if (currency === 'JPY') return toNumber(product?.costs?.JPY) * toNumber(settings.fxJpyToEur);
  if (currency === 'USD') return toNumber(product?.costs?.USD) * toNumber(settings.fxUsdToEur);
  if (currency === 'SGD') return toNumber(product?.costs?.SGD) * toNumber(settings.fxSgdToEur);
  if (currency === 'AUD') return toNumber(product?.costs?.AUD) * toNumber(settings.fxAudToEur);

  return toNumber(product?.costs?.EUR);
}

export function getLandedCostEur(product, settings) {
  return (
    getSourceCostEur(product, settings) +
    toNumber(settings.inboundShipping) +
    toNumber(settings.packaging) +
    toNumber(settings.misc)
  );
}

export function roundUpWithEnding(value, step = 1, ending = 0.9) {
  if (!Number.isFinite(value) || value <= 0) return 0;

  const safeStep = step > 0 ? step : 1;
  const floored = Math.floor(value / safeStep) * safeStep;
  let candidate = floored + ending;

  if (candidate < value) candidate += safeStep;
  return Number(candidate.toFixed(2));
}

export function computePlatformPrice(landedCost, platform) {
  const percentFees = toNumber(platform.feePct) + toNumber(platform.paymentPct);
  const fixedFees = toNumber(platform.fixedFee) + toNumber(platform.shippingSubsidy);
  const desiredNet = landedCost * (1 + toNumber(platform.targetMarginPct));
  const denominator = 1 - percentFees;

  if (denominator <= 0) {
    return {
      salePrice: 0,
      profit: 0,
      marginPct: 0,
      percentFees
    };
  }

  const rawPrice = (desiredNet + fixedFees) / denominator;
  const salePrice = roundUpWithEnding(rawPrice, toNumber(platform.roundStep), toNumber(platform.ending));
  const netAfterFees = salePrice * (1 - percentFees) - fixedFees;
  const profit = netAfterFees - landedCost;
  const marginPct = salePrice > 0 ? profit / salePrice : 0;

  return {
    salePrice,
    profit,
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
