import SideNav from './SideNav';
import TopBar from './TopBar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SideNav />
      <TopBar />
      <main className="min-h-screen relative" style={{ marginLeft: '280px', paddingTop: '80px' }}>
        <div className="relative z-10 max-w-[1600px] mx-auto w-full" style={{ padding: '2.618rem 2.5rem' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
