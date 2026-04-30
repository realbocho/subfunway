import type { Metadata, Viewport } from 'next';
import { Space_Grotesk, JetBrains_Mono, Noto_Sans_KR } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['300', '400', '500', '600', '700'],
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '700'],
});

const body = Noto_Sans_KR({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '700'],
});

export const metadata: Metadata = {
  title: '서브웨이 커넥트 | 지하철 실시간 게임',
  description: '지루한 이동 시간을 즐거운 연결로. 열차 번호로 연결되는 지하철 칸 단위 실시간 게임 플랫폼.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '서브웨이 커넥트',
  },
  openGraph: {
    title: '서브웨이 커넥트',
    description: '지하철에서 즐기는 실시간 멀티플레이 게임',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0A0A0F',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${display.variable} ${mono.variable} ${body.variable}`}>
      <body className="bg-subway-darker text-subway-text font-body antialiased overflow-x-hidden">
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
