import './globals.css'
import { Inter } from 'next/font/google'
import ClientLayout from '@/components/ClientLayout'
import { getBrandConfig } from '@/config/brand'

const inter = Inter({ subsets: ['latin'] })
const brandConfig = getBrandConfig()

export const metadata = {
  title: `${brandConfig.displayName} - AI Assistant`,
  description: 'Personalized AI Assistant for various contexts',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  )
}
