/**
 * src/app/layout.js
 * Root Layout لمشروع Stream Hunter
 * يُطبَّق على جميع الصفحات
 */

import './globals.css';
import Providers from './providers';

export const metadata = {
  title: '🎬 كورة لايف – منصة البث الرياضي المباشر',
  description:
    'شاهد مباريات اليوم مباشرة. منصة بث ذكية تصطاد إشارة البث تلقائيًا وتعرضها في متصفحك.',
  keywords: 'بث مباشر, مباريات اليوم, كورة لايف, بث رياضي',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
