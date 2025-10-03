export const metadata = {
  title: 'Agent Runner - AI Unified',
  description: 'Run autonomous coding agents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
