'use client';

import { useEffect, useMemo, useState } from 'react';
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

const STORAGE_KEY = 'tkcollectibles-platform-pricing-v1';

function cloneDefaults() {
  return {
    settings: {
      ...DEFAULT_GLOBAL_SETTINGS,
      vatRate: 0.22
    },
    platforms: DEFAULT_PLATFORMS.map((item) => ({ ...item }))
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
            vatRate: 0.22,
            ...(parsed.settings || {})
          },
          platforms: DEFAULT_PLATFORMS.map((platform) => ({
            ...platform,
            ...((parsed.platforms || []).find((item) => item.key === platform.key) || {})
          }))
        });
      }
    } catch {}
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

        if (active) setSupplierData(data);
      } catch (error) {
        if (active) {
          setSupplierData((current) => ({
            ...current,
            status: 'fallback',
            usedFallback: true,
            error: error.message || 'Errore nel caricamento del feed.'
          }));
        }
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
        const sourceCost = getSourceCostEur(product);
        const landedCost = getLandedCostEur(product, state.settings);

        const platformResults = Object.fromEntries(
          state.platforms.map((platform) => [
            platform.key,
            computePlatformPrice(landedCost, platform, state.settings)
          ])
        );

        return {
          ...product,
          sourceCost,
          landedCost,
          platformResults
        };
      });
  }, [search, sectionFilter, unitFilter, state, supplierData.products]);

  function updateSetting(key, value) {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: value
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

  function resetDefaults() {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(cloneDefaults());
  }

  function exportCsv() {
    const headers = [
      'Section',
      'Name',
      'Unit',
      'Stock',
      'Supplier cost (€)',
      'Landed cost (€)',
      ...state.platforms.flatMap((platform) => [
        `${platform.name} price IVA (€)`,
        `${platform.name} profit (€)`,
        `${platform.name} margin`
      ])
    ];

    const lines = [headers.join(',')];

    tableRows.forEach((row) => {
      const cells = [
        row.section,
        row.name,
        row.unit,
        row.stock,
        row.sourceCost.toFixed(2),
        row.landedCost.toFixed(2),
        ...state.platforms.flatMap((platform) => {
          const result = row.platformResults[platform.key];
          return [
            result.salePrice.toFixed(2),
            result.profit.toFixed(2),
            `${(result.marginPct * 100).toFixed(1)}%`
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
      <section className="panel">
        <h2>Costi globali</h2>

        <div className="form-grid">
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
        </div>
      </section>

      <section className="panel">
        <h2>Fee per piattaforma</h2>

        <div className="platform-grid">
          {state.platforms.map((platform) => (
            <div key={platform.key}>
              <h3>{platform.name}</h3>

              <input
                type="number"
                step="0.01"
                value={platform.targetMarginPct}
                onChange={(e) =>
                  updatePlatform(platform.key, 'targetMarginPct', e.target.value)
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Prezzi finali (IVA inclusa)</h2>

        <table>
          <thead>
            <tr>
              <th>Prodotto</th>
              <th>Costo</th>
              <th>Landed</th>
              {state.platforms.map((p) => (
                <th key={p.key}>{p.name}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {tableRows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{formatCurrency(row.sourceCost)}</td>
                <td>{formatCurrency(row.landedCost)}</td>

                {state.platforms.map((platform) => {
                  const r = row.platformResults[platform.key];

                  return (
                    <td key={platform.key}>
                      <strong>{formatCurrency(r.salePrice)}</strong>
                      <br />
                      <small>
                        utile {formatCurrency(r.profit)} · {formatPercent(r.marginPct)}
                      </small>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
