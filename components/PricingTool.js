'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { DEFAULT_GLOBAL_SETTINGS, formatCurrency } from '../lib/pricing';

const STORAGE_KEY = 'tkcollectibles-pricing-v7';

const DEFAULT_SETTINGS = {
  ...DEFAULT_GLOBAL_SETTINGS,
  iva: 0.22,
  inboundShipping: 0,
  packaging: 0.5,
  misc: 0,
  realShippingCostExVat: 4.36
};

const DEFAULT_PLATFORMS = [
  {
    key: 'ebay',
    name: 'eBay',
    feePct: 0.065,
    paymentPct: 0.0035,
    fixedFee: 0.35,
    adsPct: 0.02,
    couponPct: 0.0555,
    shippingCustomerInclVat: 6.49,
    targetMode: 'percent',
    targetMarginPct: 0.13,
    targetMarginEur: 8,
    roundStep: 1,
    ending: 0.99
  },
  {
    key: 'cardmarket',
    name: 'Cardmarket',
    feePct: 0.05,
    paymentPct: 0.02,
    fixedFee: 0,
    adsPct: 0,
    couponPct: 0,
    shippingCustomerInclVat: 5.5,
    targetMode: 'percent',
    targetMarginPct: 0.18,
    targetMarginEur: 8,
    roundStep: 1,
    ending: 0.99
  },
  {
    key: 'shopify',
    name: 'Shopify',
    feePct: 0.02,
    paymentPct: 0.014,
    fixedFee: 0.25,
    adsPct: 0,
    couponPct: 0,
    shippingCustomerInclVat: 7.5,
    targetMode: 'percent',
    targetMarginPct: 0.16,
    targetMarginEur: 8,
    roundStep: 1,
    ending: 0.99
  },
  {
    key: 'direct',
    name: 'Diretto',
    feePct: 0,
    paymentPct: 0,
    fixedFee: 0,
    adsPct: 0,
    couponPct: 0,
    shippingCustomerInclVat: 6.5,
    targetMode: 'percent',
    targetMarginPct: 0.12,
    targetMarginEur: 8,
    roundStep: 1,
    ending: 0.99
  }
];

const SHEET_TABS = [
  { key: 'pokemon', label: 'Pokémon' },
  { key: 'onepiece', label: 'One Piece' }
   { key: 'pokemon kor', label: 'Pokemon Kor' }
];

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatPercent(value) {
  return `${(toNumber(value) * 100).toFixed(1)}%`;
}

function cloneDefaults() {
  return {
    settings: { ...DEFAULT_SETTINGS, sourceCurrency: 'EUR' },
    platforms: DEFAULT_PLATFORMS.map((item) => ({ ...item })),
    itemTargets: {},
    activeSheet: 'pokemon'
  };
}

function roundUpWithEnding(value, step = 1, ending = 0.99) {
  if (!Number.isFinite(value) || value <= 0) return 0;

  const safeStep = step > 0 ? step : 1;
  const floored = Math.floor(value / safeStep) * safeStep;
  let candidate = floored + ending;

  if (candidate < value) candidate += safeStep;

  return Number(candidate.toFixed(2));
}

function getCost(product) {
  return toNumber(product?.costs?.EUR);
}

function getLanded(product, settings) {
  return (
    getCost(product) +
    toNumber(settings.inboundShipping) +
    toNumber(settings.packaging) +
    toNumber(settings.misc)
  );
}

function getTargetProfit(landed, platform) {
  if (platform.targetMode === 'euro') {
    return toNumber(platform.targetMarginEur);
  }
  return landed * toNumber(platform.targetMarginPct);
}

function getTrendInfo(trend) {
  const text = String(trend || '').trim().toLowerCase();

  if (text.includes('up') || text.includes('↑') || text.includes('rialzo') || text.includes('sale')) {
    return { icon: '🔺', label: trend || 'Up' };
  }

  if (text.includes('down') || text.includes('↓') || text.includes('ribasso') || text.includes('scende')) {
    return { icon: '🔻', label: trend || 'Down' };
  }

  return { icon: '➖', label: trend || 'Invariato' };
}

function computeSuggestedPrice(product, platform, settings) {
  const landed = getLanded(product, settings);

  const iva = toNumber(settings.iva);
  const shippingReal = toNumber(settings.realShippingCostExVat);

  const feePct =
    toNumber(platform.feePct) +
    toNumber(platform.paymentPct) +
    toNumber(platform.adsPct) +
    toNumber(platform.couponPct);

  const fixedFee = toNumber(platform.fixedFee);
  const shippingCustomer = toNumber(platform.shippingCustomerInclVat);
  const targetProfit = getTargetProfit(landed, platform);

  const denominator = 1 - feePct;

  if (denominator <= 0) {
    return {
      salePrice: 0,
      totalCustomerInclVat: 0,
      feesAmount: 0,
      payoutAfterFees: 0,
      netAfterVat: 0,
      netReal: 0,
      profit: 0,
      realMarginPct: 0,
      marginOnSalePct: 0,
      markupOnLandedPct: 0,
      targetProfit,
      landed
    };
  }

  const targetBase = landed + shippingReal + targetProfit;
  const grossNeeded = ((targetBase + fixedFee) * (1 + iva)) / denominator;
  const rawSalePrice = grossNeeded - shippingCustomer;

  const salePrice = roundUpWithEnding(
    rawSalePrice,
    toNumber(platform.roundStep),
    toNumber(platform.ending)
  );

  return computeAtListingPrice(product, platform, settings, salePrice);
}

function computeAtListingPrice(product, platform, settings, listingPriceInclVat) {
  const landed = getLanded(product, settings);

  const iva = toNumber(settings.iva);
  const shippingReal = toNumber(settings.realShippingCostExVat);

  const feePct =
    toNumber(platform.feePct) +
    toNumber(platform.paymentPct) +
    toNumber(platform.adsPct) +
    toNumber(platform.couponPct);

  const fixedFee = toNumber(platform.fixedFee);
  const shippingCustomer = toNumber(platform.shippingCustomerInclVat);

  const salePrice = toNumber(listingPriceInclVat);
  const totalCustomerInclVat = salePrice + shippingCustomer;

  const feesAmount = totalCustomerInclVat * feePct + fixedFee;
  const payoutAfterFees = totalCustomerInclVat - feesAmount;
  const netAfterVat = payoutAfterFees / (1 + iva);
  const netReal = netAfterVat - shippingReal;
  const profit = netReal - landed;

  const markupOnLandedPct = landed > 0 ? profit / landed : 0;
  const realMarginPct = netReal > 0 ? profit / netReal : 0;
  const marginOnSalePct = salePrice > 0 ? profit / salePrice : 0;

  return {
    salePrice,
    totalCustomerInclVat,
    feesAmount,
    payoutAfterFees,
    netAfterVat,
    netReal,
    profit,
    realMarginPct,
    marginOnSalePct,
    markupOnLandedPct,
    landed
  };
}

function targetLabel(platform) {
  if (platform.targetMode === 'euro') {
    return formatCurrency(platform.targetMarginEur);
  }
  return formatPercent(platform.targetMarginPct);
}

export default function PricingTool() {
  const [supplierData, setSupplierData] = useState({
    updatedAt: '',
    validUntil: '',
    products: [],
    sheetUrl: '',
    status: 'loading',
    usedFallback: false,
    error: '',
    sheetKey: 'pokemon'
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [state, setState] = useState(cloneDefaults());
  const [openRows, setOpenRows] = useState({});

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw);

        setState({
          settings: {
            ...DEFAULT_SETTINGS,
            ...(parsed.settings || {}),
            sourceCurrency: 'EUR'
          },
          platforms: DEFAULT_PLATFORMS.map((platform) => ({
            ...platform,
            ...((parsed.platforms || []).find((item) => item.key === platform.key) || {})
          })),
          itemTargets: parsed.itemTargets || {},
          activeSheet: parsed.activeSheet || 'pokemon'
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);

      try {
        const response = await fetch(`/api/supplier-feed?sheet=${state.activeSheet}`, { cache: 'no-store' });
        const data = await response.json();

        if (!active) return;
        setSupplierData(data);
      } catch (error) {
        if (!active) return;

        setSupplierData((current) => ({
          ...current,
          status: 'fallback',
          usedFallback: true,
          error: error.message || 'Errore nel caricamento del feed.'
        }));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [state.activeSheet]);

  const sections = useMemo(() => {
    const set = new Set(['all']);
    supplierData.products.forEach((product) => set.add(product.section || 'Other'));
    return [...set];
  }, [supplierData.products]);

  const units = useMemo(() => {
    const set = new Set(['all']);
    supplierData.products.forEach((product) => set.add(product.unit || '-'));
    return [...set];
  }, [supplierData.products]);

  const tableRows = useMemo(() => {
    return supplierData.products
      .filter((product) => {
        const matchesSearch = `${product.name} ${product.unit}`.toLowerCase().includes(search.toLowerCase());
        const matchesSection = sectionFilter === 'all' || product.section === sectionFilter;
        const matchesUnit = unitFilter === 'all' || product.unit === unitFilter;
        return matchesSearch && matchesSection && matchesUnit;
      })
      .map((product) => {
        const cost = getCost(product);
        const landed = getLanded(product, state.settings);
        const trendInfo = getTrendInfo(product.trend);

        const platformResults = Object.fromEntries(
          state.platforms.map((platform) => {
            const override = state.itemTargets?.[`${state.activeSheet}:${product.id}`]?.[platform.key] || {};

            const effectivePlatform = {
              ...platform,
              targetMode: override.targetMode ?? platform.targetMode,
              targetMarginPct:
                override.targetMarginPct !== undefined && override.targetMarginPct !== ''
                  ? Number(override.targetMarginPct)
                  : platform.targetMarginPct,
              targetMarginEur:
                override.targetMarginEur !== undefined && override.targetMarginEur !== ''
                  ? Number(override.targetMarginEur)
                  : platform.targetMarginEur
            };

            const suggested = computeSuggestedPrice(product, effectivePlatform, state.settings);

            const finalPrice =
              override.finalPrice !== undefined && override.finalPrice !== ''
                ? Number(override.finalPrice)
                : null;

            const current =
              finalPrice && finalPrice > 0
                ? computeAtListingPrice(product, effectivePlatform, state.settings, finalPrice)
                : null;

            return [
              platform.key,
              {
                suggested,
                current,
                effectivePlatform,
                finalPrice
              }
            ];
          })
        );

        return {
          ...product,
          cost,
          landed,
          trendInfo,
          platformResults
        };
      });
  }, [search, sectionFilter, unitFilter, state, supplierData.products]);

  const totals = useMemo(() => {
    const rowCount = tableRows.length || 1;
    const averageLanded = tableRows.reduce((sum, row) => sum + row.landed, 0) / rowCount;

    return {
      products: tableRows.length,
      averageLanded,
      highestEbay:
        tableRows.reduce(
          (max, row) => Math.max(max, row.platformResults.ebay?.suggested?.salePrice || 0),
          0
        ) || 0
    };
  }, [tableRows]);

  function updateSetting(key, value) {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: value,
        sourceCurrency: 'EUR'
      }
    }));
  }

  function updatePlatform(key, field, value) {
    setState((current) => ({
      ...current,
      platforms: current.platforms.map((platform) =>
        platform.key === key ? { ...platform, [field]: value } : platform
      )
    }));
  }

  function updateItemTarget(productId, platformKey, field, value) {
    const scopedId = `${state.activeSheet}:${productId}`;

    setState((current) => ({
      ...current,
      itemTargets: {
        ...current.itemTargets,
        [scopedId]: {
          ...(current.itemTargets?.[scopedId] || {}),
          [platformKey]: {
            ...(current.itemTargets?.[scopedId]?.[platformKey] || {}),
            [field]: value
          }
        }
      }
    }));
  }

  function resetItemTargets(productId) {
    const scopedId = `${state.activeSheet}:${productId}`;

    setState((current) => {
      const next = { ...(current.itemTargets || {}) };
      delete next[scopedId];

      return {
        ...current,
        itemTargets: next
      };
    });
  }

  function resetDefaults() {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(cloneDefaults());
  }

  function toggleRow(productId) {
    const scopedId = `${state.activeSheet}:${productId}`;
    setOpenRows((current) => ({
      ...current,
      [scopedId]: !current[scopedId]
    }));
  }

  function changeSheet(sheetKey) {
    setSearch('');
    setSectionFilter('all');
    setUnitFilter('all');
    setOpenRows({});
    setState((current) => ({
      ...current,
      activeSheet: sheetKey
    }));
  }

  return (
    <div className="page-shell">
      <section className="hero-card">
        <div>
          <span className="eyebrow">TKCollectibles · internal pricing tool</span>
          <h1>Prezzi consigliati</h1>
          <p>
            Lo scopo del tool è dirti a che prezzo vendere per ottenere il netto che vuoi.
            Le fee percentuali vengono calcolate sul totale incassato: articolo + spedizione cliente.
          </p>
        </div>

        <div className="hero-stats">
          <div className="stat-card">
            <span>Prodotti visibili</span>
            <strong>{totals.products}</strong>
          </div>
          <div className="stat-card">
            <span>Costo medio landed</span>
            <strong>{formatCurrency(totals.averageLanded)}</strong>
          </div>
          <div className="stat-card">
            <span>Prezzo eBay più alto</span>
            <strong>{formatCurrency(totals.highestEbay)}</strong>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head">
          <h2>Catalogo</h2>
          <p className="helper">Seleziona il foglio da visualizzare.</p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {SHEET_TABS.map((tab) => {
            const isActive = state.activeSheet === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => changeSheet(tab.key)}
                className="ghost-button"
                style={{
                  minWidth: 140,
                  borderColor: isActive ? 'rgba(255,255,255,0.38)' : undefined,
                  background: isActive ? 'rgba(255,255,255,0.08)' : undefined
                }}
              >
                {isActive ? `● ${tab.label}` : tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="status-row">
        <div className={`status-pill ${supplierData.status === 'live' ? 'ok' : 'warn'}`}>
          {loading
            ? 'Caricamento feed...'
            : supplierData.status === 'live'
              ? `Feed live: ${state.activeSheet === 'pokemon' ? 'Pokémon' : 'One Piece'}`
              : 'Feed demo di fallback'}
        </div>

        <div className="status-meta">
          {supplierData.updatedAt && <span>{supplierData.updatedAt}</span>}
          {supplierData.validUntil && <span>{supplierData.validUntil}</span>}
          {supplierData.sheetUrl && (
            <a href={supplierData.sheetUrl} target="_blank" rel="noreferrer">
              Apri sheet
            </a>
          )}
        </div>
      </section>

      <section className="grid-two">
        <div className="panel">
          <div className="panel-head">
            <h2>Costi globali</h2>
            <button className="ghost-button" onClick={resetDefaults}>
              Reset tutto
            </button>
          </div>

          <div className="form-grid">
            <label>
              <span>Valuta sorgente</span>
              <input value="EUR (colonna Prezzo Euro)" disabled />
            </label>

            <label>
              <span>IVA</span>
              <input
                type="number"
                step="0.01"
                value={state.settings.iva}
                onChange={(e) => updateSetting('iva', e.target.value)}
              />
            </label>

            <label>
              <span>Inbound shipping €/pezzo</span>
              <input
                type="number"
                step="0.01"
                value={state.settings.inboundShipping}
                onChange={(e) => updateSetting('inboundShipping', e.target.value)}
              />
            </label>

            <label>
              <span>Packaging €/pezzo</span>
              <input
                type="number"
                step="0.01"
                value={state.settings.packaging}
                onChange={(e) => updateSetting('packaging', e.target.value)}
              />
            </label>

            <label>
              <span>Extra misc €/pezzo</span>
              <input
                type="number"
                step="0.01"
                value={state.settings.misc}
                onChange={(e) => updateSetting('misc', e.target.value)}
              />
            </label>

            <label>
              <span>Spedizione reale tua (€ ex IVA)</span>
              <input
                type="number"
                step="0.01"
                value={state.settings.realShippingCostExVat}
                onChange={(e) => updateSetting('realShippingCostExVat', e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Filtri</h2>
          </div>

          <div className="form-grid">
            <label className="full-width">
              <span>Cerca prodotto</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ninja Spinner, OP-09, Romance Dawn..."
              />
            </label>

            <label>
              <span>Sezione</span>
              <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
                {sections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Unità</span>
              <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
                {units.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {supplierData.error ? (
            <p className="helper error">{supplierData.error}</p>
          ) : (
            <p className="helper">
              Puoi lavorare sia in % sul landed sia in € netti desiderati.
            </p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Fee e target globali per piattaforma</h2>
          <p className="helper">Qui imposti la logica base. Sotto puoi personalizzare per singolo articolo.</p>
        </div>

        <div className="platform-grid">
          {state.platforms.map((platform) => (
            <div className="platform-card" key={platform.key}>
              <h3>{platform.name}</h3>

              <div className="form-grid compact">
                <label>
                  <span>Marketplace fee</span>
                  <input
                    type="number"
                    step="0.001"
                    value={platform.feePct}
                    onChange={(e) => updatePlatform(platform.key, 'feePct', e.target.value)}
                  />
                </label>

                <label>
                  <span>Pagamento fee</span>
                  <input
                    type="number"
                    step="0.001"
                    value={platform.paymentPct}
                    onChange={(e) => updatePlatform(platform.key, 'paymentPct', e.target.value)}
                  />
                </label>

                <label>
                  <span>Ads %</span>
                  <input
                    type="number"
                    step="0.001"
                    value={platform.adsPct}
                    onChange={(e) => updatePlatform(platform.key, 'adsPct', e.target.value)}
                  />
                </label>

                <label>
                  <span>Coupon %</span>
                  <input
                    type="number"
                    step="0.001"
                    value={platform.couponPct}
                    onChange={(e) => updatePlatform(platform.key, 'couponPct', e.target.value)}
                  />
                </label>

                <label>
                  <span>Fee fissa €</span>
                  <input
                    type="number"
                    step="0.01"
                    value={platform.fixedFee}
                    onChange={(e) => updatePlatform(platform.key, 'fixedFee', e.target.value)}
                  />
                </label>

                <label>
                  <span>Spedizione cliente IVA incl.</span>
                  <input
                    type="number"
                    step="0.01"
                    value={platform.shippingCustomerInclVat}
                    onChange={(e) => updatePlatform(platform.key, 'shippingCustomerInclVat', e.target.value)}
                  />
                </label>

                <label>
                  <span>Modalità target</span>
                  <select
                    value={platform.targetMode}
                    onChange={(e) => updatePlatform(platform.key, 'targetMode', e.target.value)}
                  >
                    <option value="percent">% sul landed</option>
                    <option value="euro">€ netti</option>
                  </select>
                </label>

                <label>
                  <span>Target %</span>
                  <input
                    type="number"
                    step="0.01"
                    value={platform.targetMarginPct}
                    onChange={(e) => updatePlatform(platform.key, 'targetMarginPct', e.target.value)}
                  />
                </label>

                <label>
                  <span>Target €</span>
                  <input
                    type="number"
                    step="0.01"
                    value={platform.targetMarginEur}
                    onChange={(e) => updatePlatform(platform.key, 'targetMarginEur', e.target.value)}
                  />
                </label>

                <label>
                  <span>Finale prezzo</span>
                  <input
                    type="number"
                    step="0.01"
                    value={platform.ending}
                    onChange={(e) => updatePlatform(platform.key, 'ending', e.target.value)}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-head">
          <h2>Prezzi consigliati</h2>
          <p className="helper">
            Vedi il prezzo suggerito, il netto reale, il margine reale %, il markup sul landed e puoi inserire il prezzo finale per ogni piattaforma.
          </p>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Prodotto</th>
                <th>Sezione</th>
                <th>Trend</th>
                <th>Prezzo Yen</th>
                <th>Costo fornitore</th>
                <th>Landed</th>
                {state.platforms.map((platform) => (
                  <th key={platform.key}>{platform.name} IVA incl.</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {tableRows.map((row) => {
                const scopedId = `${state.activeSheet}:${row.id}`;
                const isOpen = Boolean(openRows[scopedId]);

                return (
                  <Fragment key={scopedId}>
                    <tr>
                      <td>
                        <div className="product-cell">
                          <strong>{row.name}</strong>
                          <span>{row.unit}</span>
                        </div>
                      </td>

                      <td>{row.section}</td>
                      <td>
                        <span title={row.trendInfo.label}>
                          {row.trendInfo.icon} {row.trendInfo.label}
                        </span>
                      </td>
                      <td>{row.yenPrice ? `¥${row.yenPrice.toLocaleString('it-IT')}` : '-'}</td>
                      <td>{formatCurrency(row.cost)}</td>
                      <td>{formatCurrency(row.landed)}</td>

                      {state.platforms.map((platform) => {
                        const result = row.platformResults[platform.key];
                        const suggested = result.suggested;
                        const current = result.current;
                        const effectivePlatform = result.effectivePlatform;

                        return (
                          <td key={`${scopedId}-${platform.key}`}>
                            <div className="price-cell">
                              <strong>{formatCurrency(current?.salePrice ?? suggested.salePrice)}</strong>
                              <span>
                                netto {formatCurrency(current?.netReal ?? suggested.netReal)} · margine reale {formatPercent(current?.realMarginPct ?? suggested.realMarginPct)}
                              </span>
                              <span style={{ display: 'block', marginTop: 4, opacity: 0.8 }}>
                                utile {formatCurrency(current?.profit ?? suggested.profit)} · markup landed {formatPercent(current?.markupOnLandedPct ?? suggested.markupOnLandedPct)}
                              </span>
                              <span style={{ display: 'block', marginTop: 4, opacity: 0.8 }}>
                                target {targetLabel(effectivePlatform)}
                              </span>
                              <span style={{ display: 'block', marginTop: 6, opacity: 0.9 }}>
                                suggerito {formatCurrency(suggested.salePrice)}
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    <tr>
                      <td
                        colSpan={6 + state.platforms.length}
                        style={{
                          padding: '12px 20px',
                          background: 'rgba(255,255,255,0.02)',
                          borderTop: '1px solid rgba(255,255,255,0.06)'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '16px',
                            flexWrap: 'wrap'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>
                              Modifiche per questo articolo
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                              Apri il pannello per modificare target e prezzo finale per piattaforma.
                            </div>
                          </div>

                          <button
                            className="ghost-button"
                            onClick={() => toggleRow(row.id)}
                            style={{ minWidth: 180 }}
                          >
                            {isOpen ? '▲ Chiudi modifiche' : '▼ Apri modifiche'}
                          </button>
                        </div>

                        {isOpen && (
                          <div
                            style={{
                              marginTop: 16,
                              display: 'grid',
                              gridTemplateColumns: `minmax(240px, 1.2fr) repeat(${state.platforms.length}, minmax(240px, 1fr)) auto`,
                              gap: '12px',
                              alignItems: 'end'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                                Target personalizzati e prezzo finale per questo articolo
                              </div>
                              <div style={{ fontSize: 13, opacity: 0.7 }}>
                                Puoi scegliere % sul landed o € netti, e impostare direttamente il prezzo finale per ogni piattaforma.
                              </div>
                            </div>

                            {state.platforms.map((platform) => {
                              const override = state.itemTargets?.[`${state.activeSheet}:${row.id}`]?.[platform.key] || {};
                              const targetMode = override.targetMode ?? platform.targetMode;
                              const targetMarginPct = override.targetMarginPct ?? platform.targetMarginPct;
                              const targetMarginEur = override.targetMarginEur ?? platform.targetMarginEur;
                              const finalPrice = override.finalPrice ?? '';

                              return (
                                <div key={`${scopedId}-${platform.key}-input`}>
                                  <label style={{ display: 'block', marginBottom: 8 }}>
                                    <span style={{ display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                                      {platform.name} modalità
                                    </span>
                                    <select
                                      value={targetMode}
                                      onChange={(e) =>
                                        updateItemTarget(row.id, platform.key, 'targetMode', e.target.value)
                                      }
                                      style={{
                                        width: '100%',
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        color: 'white',
                                        borderRadius: 10,
                                        padding: '10px 12px'
                                      }}
                                    >
                                      <option value="percent">% sul landed</option>
                                      <option value="euro">€ netti</option>
                                    </select>
                                  </label>

                                  <label style={{ display: 'block', marginBottom: 8 }}>
                                    <span style={{ display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                                      {platform.name} target %
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={targetMarginPct}
                                      onChange={(e) =>
                                        updateItemTarget(row.id, platform.key, 'targetMarginPct', e.target.value)
                                      }
                                      style={{
                                        width: '100%',
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        color: 'white',
                                        borderRadius: 10,
                                        padding: '10px 12px'
                                      }}
                                    />
                                  </label>

                                  <label style={{ display: 'block', marginBottom: 8 }}>
                                    <span style={{ display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                                      {platform.name} target €
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={targetMarginEur}
                                      onChange={(e) =>
                                        updateItemTarget(row.id, platform.key, 'targetMarginEur', e.target.value)
                                      }
                                      style={{
                                        width: '100%',
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        color: 'white',
                                        borderRadius: 10,
                                        padding: '10px 12px'
                                      }}
                                    />
                                  </label>

                                  <label style={{ display: 'block' }}>
                                    <span style={{ display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                                      {platform.name} prezzo finale
                                    </span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={finalPrice}
                                      onChange={(e) =>
                                        updateItemTarget(row.id, platform.key, 'finalPrice', e.target.value)
                                      }
                                      style={{
                                        width: '100%',
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        color: 'white',
                                        borderRadius: 10,
                                        padding: '10px 12px'
                                      }}
                                    />
                                  </label>
                                </div>
                              );
                            })}

                            <div>
                              <button
                                className="ghost-button"
                                onClick={() => resetItemTargets(row.id)}
                                style={{ width: '100%' }}
                              >
                                Reset articolo
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}

              {!tableRows.length && (
                <tr>
                  <td colSpan={6 + state.platforms.length} className="empty-cell">
                    Nessun prodotto trovato con i filtri selezionati.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
