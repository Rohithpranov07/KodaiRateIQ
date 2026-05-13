import SideNav from './SideNav';
import TopBar from './TopBar';
import MobileNav from './MobileNav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-ivory)' }}>
      <SideNav />
      <TopBar />
      <MobileNav />
      {/* 68px topbar height, 272px sidebar width on md+ */}
      <main className="min-h-screen md:ml-68 pt-17 pb-28 md:pb-0">
        <div className="relative z-10 max-w-380 mx-auto w-full px-4 md:px-8 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
