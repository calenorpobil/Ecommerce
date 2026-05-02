import { Sidebar } from '@/components/Sidebar'
import { WalletButton } from '@/components/WalletButton'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 shrink-0 border-b border-zinc-800 bg-zinc-900 flex items-center justify-end px-6">
          <WalletButton />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
