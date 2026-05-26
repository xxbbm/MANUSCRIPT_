import './globals.css';
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: 'MANUSCRIPT - Digital Solitude',
  description: 'Minimal AI messaging interface with server-side model proxying.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          id="fontcss"
          href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400..700;1,400..600&family=Literata:ital,opsz,wght@0,7..72,300..600;1,7..72,300..500&family=Cormorant+Garamond:ital,wght@0,300..600;1,300..500&family=JetBrains+Mono:wght@300;400;500&family=Caveat:wght@400..700&family=Dancing+Script:wght@400..600&family=Noto+Serif+SC:wght@200;300;400;500;600&family=ZCOOL+XiaoWei&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
