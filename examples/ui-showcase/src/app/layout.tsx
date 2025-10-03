import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Unified - UI Showcase',
  description: 'Comprehensive showcase of all AI Unified UI components and functions',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gray-50">
          {/* Header */}
          <header className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">AI Unified</h1>
                  <p className="text-sm text-gray-500">UI Component Showcase</p>
                </div>
                <nav className="flex space-x-6">
                  <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Home
                  </Link>
                  <Link href="/chat" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Chat
                  </Link>
                  <Link href="/agent" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Agent
                  </Link>
                  <Link href="/models" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Models
                  </Link>
                  <Link href="/keyring" className="text-gray-600 hover:text-gray-900 transition-colors">
                    Keyring
                  </Link>
                </nav>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-200 mt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <p className="text-center text-gray-500 text-sm">
                AI Unified v0.1.0 - Showcasing headless UI components
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
