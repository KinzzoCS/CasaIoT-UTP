import { Inter, JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';
import ClientLayout from './ClientLayout';

// next/font descarga las fuentes en el build y las sirve desde el propio
// servidor: sin @import bloqueante a Google Fonts y sin peticiones a terceros
// desde el navegador (coherente con una plataforma 100 % local).
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata = {
  title: 'CasaIoT',
  description: 'Plataforma Smart Home segura y minimalista',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: '/favicon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CasaIoT',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
  colorScheme: 'light dark',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <div id="app-root" style={{ position: 'relative', minHeight: '100dvh' }}>
          <ClientLayout>{children}</ClientLayout>
        </div>
      </body>
    </html>
  );
}
