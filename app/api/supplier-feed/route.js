import { SHEET_CSV_URL, SHEET_EDIT_URL } from "../../../lib/config";
import { fallbackSupplierData, parseSupplierCsv } from "../../../lib/sheet";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch(SHEET_CSV_URL, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'TKCollectibles Pricing Bot/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Supplier sheet returned ${response.status}`);
    }

    const csvText = await response.text();
    const parsed = parseSupplierCsv(csvText);

    return Response.json({
      ...parsed,
      sheetUrl: SHEET_EDIT_URL,
      status: 'live'
    });
  } catch (error) {
    const fallback = fallbackSupplierData();
    return Response.json({
      ...fallback,
      sheetUrl: SHEET_EDIT_URL,
      status: 'fallback',
      error: error.message || 'Unable to fetch supplier sheet right now.'
    });
  }
}
