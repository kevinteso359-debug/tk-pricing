export const SHEET_ID = '1ogdEGyH8fzrVbqrMcNDuHVjk9cE32XDKN5TOWX8D2Ak';
export const SHEET_GID = '0';
export const SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${SHEET_GID}#gid=${SHEET_GID}`;
export const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

export const FALLBACK_PRODUCTS = [
  {
    id: 'black-bolt-box',
    section: 'In stock',
    name: 'BLACK BOLT 〖SV11B〗',
    unit: 'BOX',
    stock: '30',
    costs: { JPY: 18400, USD: 115.56, EUR: 99.97, SGD: 148.06, AUD: 164.26 }
  },
  {
    id: 'white-flare-box',
    section: 'In stock',
    name: 'WHITE FLARE 〖SV11W〗',
    unit: 'BOX',
    stock: '30',
    costs: { JPY: 17500, USD: 109.91, EUR: 95.08, SGD: 140.82, AUD: 156.22 }
  },
  {
    id: 'rocket-box',
    section: 'In stock',
    name: 'rocket〖SV10〗',
    unit: 'BOX',
    stock: '50',
    costs: { JPY: 19000, USD: 119.33, EUR: 103.23, SGD: 152.89, AUD: 169.61 }
  },
  {
    id: 'mega-brave-box',
    section: 'In stock',
    name: 'mega brave〖M1L〗',
    unit: 'BOX',
    stock: '50',
    costs: { JPY: 10400, USD: 65.32, EUR: 56.50, SGD: 83.69, AUD: 92.84 }
  },
  {
    id: 'mega-symphonia-box',
    section: 'In stock',
    name: 'Mega Symphonia 〖M1S〗',
    unit: 'BOX',
    stock: '100',
    costs: { JPY: 9500, USD: 59.67, EUR: 51.61, SGD: 76.45, AUD: 84.81 }
  },
  {
    id: 'ninja-spinner-box',
    section: 'In stock',
    name: 'Ninja Spinner〖M4〗',
    unit: 'BOX',
    stock: '300',
    costs: { JPY: 10700, USD: 67.20, EUR: 58.13, SGD: 86.10, AUD: 95.52 }
  }
];
