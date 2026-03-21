import { NextResponse } from 'next/server';
import { fallbackSupplierData, parseSupplierCsv } from '../../../lib/sheet';
import { DEFAULT_GLOBAL_SETTINGS } from '../../../lib/pricing';

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1ogdEGyH8fzrVbqrMcNDuHVjk9cE32XDKN5TOWX8D2Ak/export?format=csv&gid=0';

const ECB_XML_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

async function fetchSupplierCsv() {
  const response = await fetch(SHEET_URL, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Errore download CSV fornitore: ${response.status}`);
  }

  return response.text();
}

async function fetchEcbJpyRate() {
  const response = await fetch(ECB_XML_URL, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Errore download cambio ECB: ${response.status}`);
  }

  const xml = await response.text();

  const match = xml.match(/currency=['"]JPY['"] rate=['"]([^'"]+)['"]/i);
  if (!match) {
    throw new Error('Cambio JPY non trovato nel feed ECB');
  }

  const jpyPerEur = Number(match[1]);
  if (!Number.isFinite(jpyPerEur) || jpyPerEur <= 0) {
    throw new Error('Cambio ECB JPY non valido');
  }

  return {
    jpyPerEur,
    fxJpyToEur: 1 / jpyPerEur
  };
}

export async function GET() {
  try {
    const [csvText, fx] = await Promise.all([fetchSupplierCsv(), fetchEcbJpyRate()]);

    const parsed = parseSupplierCsv(csvText);

    return NextResponse.json({
      status: 'live',
      updatedAt: parsed.updatedAt || '',
      validUntil: parsed.validUntil || '',
      products: parsed.products || [],
      usedFallback: parsed.usedFallback || false,
      error: '',
      sheetUrl: SHEET_URL.replace('/export?format=csv&gid=0', '/edit?gid=0#gid=0'),
      fx,
      defaults: {
        ...DEFAULT_GLOBAL_SETTINGS,
        sourceCurrency: 'JPY',
        fxJpyToEur: fx.fxJpyToEur
      }
    });
  } catch (error) {
    const fallback = fallbackSupplierData();

    return NextResponse.json({
      status: 'fallback',
      updatedAt: fallback.updatedAt || '',
      validUntil: fallback.validUntil || '',
      products: fallback.products || [],
      usedFallback: true,
      error: error?.message || 'Errore nel caricamento del feed fornitore',
      sheetUrl: SHEET_URL.replace('/export?format=csv&gid=0', '/edit?gid=0#gid=0'),
      fx: {
        jpyPerEur: 1 / DEFAULT_GLOBAL_SETTINGS.fxJpyToEur,
        fxJpyToEur: DEFAULT_GLOBAL_SETTINGS.fxJpyToEur
      },
      defaults: {
        ...DEFAULT_GLOBAL_SETTINGS,
        sourceCurrency: 'JPY'
      }
    });
  }
}
