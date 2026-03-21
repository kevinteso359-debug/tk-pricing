import './globals.css';

export const metadata = {
  title: 'TKCollectibles Platform Pricing',
  description: 'Internal pricing tool for marketplace-specific fees.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
