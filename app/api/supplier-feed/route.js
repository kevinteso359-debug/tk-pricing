import { NextResponse } from 'next/server';
import { fallbackSupplierData, parseSupplierCsv } from '../../../lib/sheet';

const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1VaZfKpSnjYcoqGL4oewT4IA8owpGCTHtU71yv5jcjqk/export?format=csv&gid=0';

export async function GET() {
  try {
    const response = await fetch(SHEET_URL, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Errore download CSV fornitore: ${response.status}`);
    }

    const csvText = await response.text();
    const parsed = parseSupplierCsv(csvText);

    return NextResponse.json({
      status: 'live',
      updatedAt: parsed.updatedAt || '',
      validUntil: parsed.validUntil || '',
      products: parsed.products || [],
      usedFallback: parsed.usedFallback || false,
      error: '',
      sheetUrl: SHEET_URL.replace('/export?format=csv&gid=0', '/edit?gid=0#gid=0')
    });
  } catch (error) {
    const fallback = fallbackSupplierData();

    return NextResponse.json({
      status: 'fallback',
      updatedAt: fallback.updatedAt || '',
      validUntil: fallback.validUntil || '',
      products: fallback.products || [],
      usedFallback: true,
      error: error?.message || 'Errore nel caricamento del feed',
      sheetUrl: SHEET_URL.replace('/export?format=csv&gid=0', '/edit?gid=0#gid=0')
    });
  }
}
