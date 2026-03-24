import { NextResponse } from 'next/server';
import { fallbackSupplierData, parseSupplierCsv } from '../../../lib/sheet';

const SHEETS = {
  pokemon: {
    gid: '0',
    editUrl: 'https://docs.google.com/spreadsheets/d/1VaZfKpSnjYcoqGL4oewT4IA8owpGCTHtU71yv5jcjqk/edit?gid=0#gid=0'
  },
  onepiece: {
    gid: '638582406',
    editUrl: 'https://docs.google.com/spreadsheets/d/1VaZfKpSnjYcoqGL4oewT4IA8owpGCTHtU71yv5jcjqk/edit?gid=638582406#gid=638582406'
  },
  dragonball: {
    gid: '2096091405',
    editUrl: 'https://docs.google.com/spreadsheets/d/1VaZfKpSnjYcoqGL4oewT4IA8owpGCTHtU71yv5jcjqk/edit?gid=2096091405#gid=2096091405'
  }
};

function getSheetUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/1VaZfKpSnjYcoqGL4oewT4IA8owpGCTHtU71yv5jcjqk/export?format=csv&gid=${gid}`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sheetKey = (searchParams.get('sheet') || 'pokemon').toLowerCase();

  const selectedSheet = SHEETS[sheetKey] || SHEETS.pokemon;
  const csvUrl = getSheetUrl(selectedSheet.gid);

  try {
    const response = await fetch(csvUrl, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Errore download CSV: ${response.status}`);
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
      sheetUrl: selectedSheet.editUrl,
      sheetKey
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
      sheetUrl: selectedSheet.editUrl,
      sheetKey
    });
  }
}
