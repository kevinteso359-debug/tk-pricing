'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_PLATFORMS,
  computePlatformPrice,
  formatCurrency,
  formatPercent,
  getLandedCostEur,
  getSourceCostEur,
  sanitizeForCsv
} from '../lib/pricing';

const STORAGE_KEY = 'tkcollectibles-platform-pricing-v3';

function cloneDefaults() {
  return {
    settings: {
      ...DEFAULT_GLOBAL_SETTINGS,
      sourceCurrency: 'EUR',
      vatRate: DEFAULT_GLOBAL_SETTINGS.vatRate ?? 0.22,
      realShippingCostExVat: DEFAULT_GLOBAL_SETTINGS.realShippingCostExVat ?? 4.36
    },
    platforms: DEFAULT_PLATFORMS.map((item) => ({ ...item })),
    itemTargets: {}
  };
}

export default function PricingTool() {
  const [supplierData, setSupplierData] = useState({
    updatedAt: '',
    validUntil: '',
    products: [],
    sheetUrl: '',
    status: 'loading',
    usedFallback: false,
    error: ''
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [state, setState] = useState(cloneDefaults());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw);

        setState({
          settings: {
            ...DEFAULT_GLOBAL_SETTINGS,
            sourceCurrency: 'EUR',
            vatRate: DEFAULT_GLOBAL_SETTINGS.vatRate ?? 0.22,
            realShippingCostExVat: DEFAULT_GLOBAL_SETTINGS.realShippingCostExVat ?? 4.36,
            ...(parsed.settings || {}),
            sourceCurrency: 'EUR'
          },
          platforms: DEFAULT_PLATFORMS.map((platform) => ({
            ...platform,
            ...((parsed.platforms || []).find((item) => item.key === platform.key) || {})
          })),
          itemTargets: parsed.itemTargets || {}
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
        const response = await fetch('/api/supplier-feed', { cache: 'no-store' });
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
  }, []);

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
        const sourceCost = getSourceCostEur(product, state.settings);
        const landedCost = getLandedCostEur(product, state.settings);

        const platformResults = Object.fromEntries(
          state.platforms.map((platform) => {
            const override = state.itemTargets?.[product.id]?.[platform.key];

            const effectivePlatform = {
              ...platform,
              targetMode: override?.targetMode ?? platform.targetMode,
              targetMarginPct:
                override?.targetMarginPct !== undefined && override?.targetMarginPct !== ''
                  ? Number(override.targetMarginPct)
                  : platform.targetMarginPct,
              targetMarginEur:
                override?.targetMarginEur !== undefined && override?.targetMarginEur !== ''
                  ? Number(override.targetMarginEur)
                  : platform.targetMarginEur
            };

            return [
              platform.key,
              computePlatformPrice(landedCost, effectivePlatform, state.settings)
            ];
          })
        );

        return {
          ...product,
          sourceCost,
          landedCost,
          platformResults
        };
      });
  }, [search, sectionFilter, unitFilter, state, supplierData.products]);

  const totals = useMemo(() => {
    const rowCount = tableRows.length || 1;
    const averageLanded = tableRows.reduce((sum, row) => sum + row.landedCost, 0) / rowCount;

    return {
      products: tableRows.length,
      averageLanded,
      highestEbay:
        tableRows.reduce((max, row) => Math.max(max, row.platformResults.ebay?.salePrice || 0), 0) || 0
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
        platform.key === key
          ? {
              ...platform,
              [field]: value
            }
          : platform
      )
    }));
  }

  function updateItemTarget(productId, platformKey, field, value) {
    setState((current) => ({
      ...current,
      itemTargets: {
        ...current.itemTargets,
        [productId]: {
          ...(current.itemTargets?.[productId] || {}),
          [platformKey]: {
            ...(current.itemTargets?.[productId]?.[platformKey] || {}),
            [field]: value
          }
        }
      }
    }));
  }

  function resetItemTargets(productId) {
    setState((current) => {
      const next = { ...(current.itemTargets || {}) };
      delete next[productId];

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

  function exportCsv() {
    const headers = [
      'Section',
      'Name',
      'Unit',
      'Trend',
      'Prezzo Yen',
      'Supplier cost (€)',
      'Landed cost (€)',
      ...state.platforms.flatMap((platform) => [
        `${platform.name} target mode`,
        `${platform.name} target`,
        `${platform.name} shipping customer`,
        `${platform.name} price IVA incl.`,
        `${platform.name} net real`,
        `${platform.name} profit`,
        `${platform.name} markup landed`
      ])
    ];

    const lines = [headers.join(',')];

    tableRows.forEach((row) => {
      const cells = [
        row.section,
        row.name,
        row.unit,
        row.trend || '',
        row.yenPrice || 0,
        row.sourceCost.toFixed(2),
        row.landedCost.toFixed(2),
        ...state.platforms.flatMap((platform) => {
          const result = row.platformResults[platform.key];
          const override = state.itemTargets?.[row.id]?.[platform.key];

          const targetMode = override?.targetMode ?? platform.targetMode;
          const targetValue =
            targetMode === 'euro'
              ? (override?.targetMarginEur ?? platform.targetMarginEur)
              : (override?.targetMarginPct ?? platform.targetMarginPct);

          return [
            targetMode,
            targetMode === 'euro'
              ? formatCurrency(targetValue)
              : formatPercent(targetValue),
            formatCurrency(platform.customerShippingInclVat),
            result.salePrice.toFixed(2),
            (result.netReal ?? 0).toFixed(2),
            result.profit.toFixed(2),
            `${((result.markupOnLandedPct ?? 0) * 100).toFixed(1)}%`
          ];
        })
      ];

      lines.push(cells.map(sanitizeForCsv).join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tkcollectibles-platform-pricing.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-shell">
      <section className="hero-card">
        <div>
          <span className="eyebrow">TKCollectibles · internal pricing tool</span>
          <h1>Price list per piattaforma</h1>
          <p>
            Lo scopo del tool è dirti a che prezzo vendere per ottenere il netto che vuoi.
            Il prezzo finale include fee piattaforma, IVA e logica spedizione.
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

      <section className="status-row">
        <div className={`status-pill ${supplierData.status === 'live' ? 'ok' : 'warn'}`}>
          {loading
            ? 'Caricamento feed...'
            : supplierData.status === 'live'
              ? 'Feed live dalla tua price list'
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
                value={state.settings.vatRate}
                onChange={(e) => updateSetting('vatRate', e.target.value)}
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
            <button className="ghost-button" onClick={exportCsv}>
              Export CSV
            </button>
          </div>

          <div className="form-grid">
            <label className="full-width">
              <span>Cerca prodotto</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ninja Spinner, Black Bolt, M4..."
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
              Fee % applicate sul totale incassato: articolo + spedizione cliente.
            </p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Fee e target globali per piattaforma</h2>
          <p className="helper">Puoi usare target in % oppure target in € netti.</p>
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
                    value={platform.customerShippingInclVat}
                    onChange={(e) => updatePlatform(platform.key, 'customerShippingInclVat', e.target.value)}
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
            Prezzo finale IVA inclusa da pubblicare + netto reale in euro + markup sul landed.
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
              {tableRows.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td>
                      <div className="product-cell">
                        <strong>{row.name}</strong>
                        <span>{row.unit}</span>
                      </div>
                    </td>

                    <td>{row.section}</td>
                    <td>{row.trend || '-'}</td>
                    <td>{row.yenPrice ? `¥${row.yenPrice.toLocaleString('it-IT')}` : '-'}</td>
                    <td>{formatCurrency(row.sourceCost)}</td>
                    <td>{formatCurrency(row.landedCost)}</td>

                    {state.platforms.map((platform) => {
                      const result = row.platformResults[platform.key];
                      const override = state.itemTargets?.[row.id]?.[platform.key];
                      const targetMode = override?.targetMode ?? platform.targetMode;
                      const targetLabel =
                        targetMode === 'euro'
                          ? formatCurrency(override?.targetMarginEur ?? platform.targetMarginEur)
                          : formatPercent(override?.targetMarginPct ?? platform.targetMarginPct);

                      return (
                        <td key={`${row.id}-${platform.key}`}>
                          <div className="price-cell">
                            <strong>{formatCurrency(result.salePrice)}</strong>
                            <span>
                              netto {formatCurrency(result.netReal)} · utile {formatCurrency(result.profit)}
                            </span>
                            <span style={{ display: 'block', marginTop: 4, opacity: 0.8 }}>
                              markup landed {formatPercent(result.markupOnLandedPct)}
                            </span>
                            <span style={{ display: 'block', marginTop: 4, opacity: 0.8 }}>
                              target {targetLabel}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  <tr>
                    <td
                      colSpan={6 + state.platforms.length}
                      style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.02)' }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: `minmax(240px, 1.2fr) repeat(${state.platforms.length}, minmax(180px, 1fr)) auto`,
                          gap: '12px',
                          alignItems: 'end'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                            Target personalizzati per questo articolo
                          </div>
                          <div style={{ fontSize: 13, opacity: 0.7 }}>
                            Puoi scegliere se impostare il target in % sul landed oppure in € netti.
                          </div>
                        </div>

                        {state.platforms.map((platform) => {
                          const override = state.itemTargets?.[row.id]?.[platform.key] || {};
                          const targetMode = override.targetMode ?? platform.targetMode;
                          const targetMarginPct =
                            override.targetMarginPct ?? platform.targetMarginPct;
                          const targetMarginEur =
                            override.targetMarginEur ?? platform.targetMarginEur;

                          return (
                            <div key={`${row.id}-${platform.key}-input`}>
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

                              <label style={{ display: 'block' }}>
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
                    </td>
                  </tr>
                </Fragment>
              ))}

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
