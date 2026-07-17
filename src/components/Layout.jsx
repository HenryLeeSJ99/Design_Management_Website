import { useState, useEffect, Suspense } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import styles from './Layout.module.css';
import Logo from './Logo';
import RouteLoader from './RouteLoader';
import { useAuth } from '../contexts/AuthContext';
import { Menu, X, SquareMenu, Layers, Building, ChevronsUp, ChevronDown, Columns, Cuboid, RefreshCw, LayoutDashboard, FolderOpen, Settings as SettingsIcon, LogOut, ShieldCheck } from 'lucide-react';
import TermsModal from './TermsModal';

// Page titles shown beside the hamburger in the mobile top header
// (pages hide their own title blocks on small viewports)
const PAGE_TITLES = [
  { path: '/calculators/multi-beam', title: 'Multi Beam Span' },
  { path: '/calculators/slab-formwork', title: 'Slab Formwork' },
  { path: '/calculators/wall-formwork/design', title: 'Wall Formwork Design' },
  { path: '/calculators/wall-formwork', title: 'Wall Formwork' },
  { path: '/calculators/shoring-tower', title: 'Shoring Tower' },
  { path: '/calculators/steel-prop', title: 'Steel Prop' },
  { path: '/dashboard', title: 'Dashboard' },
  { path: '/projects', title: 'Projects' },
];

// Static sidebar catalogue — groups with subItems render as expandable
// sections so the calculator list stays compact.
const CALCULATOR_NAV = [
  { name: 'Multi Beam Span', path: '/calculators/multi-beam', icon: SquareMenu, active: true },
  { name: 'Slab Formwork', path: '/calculators/slab-formwork', icon: Layers, active: true },
  {
    name: 'Wall Formwork',
    icon: Building,
    active: true,
    subItems: [
      { name: 'Concrete Pressure', path: '/calculators/wall-formwork' },
      { name: 'Panel & Tie Design', path: '/calculators/wall-formwork/design' },
    ]
  },
  { name: 'Shoring Tower', path: '/calculators/shoring-tower', icon: ChevronsUp, active: true },
  { name: 'Steel Prop', path: '/calculators/steel-prop', icon: ChevronsUp, active: true },
  { name: 'Column Formwork', path: '#', icon: Columns, active: false },
  { name: 'Beam Formwork', path: '#', icon: Cuboid, active: false },
];

/** Names of the groups whose sub-items contain the given route. */
function groupsContaining(pathname) {
  return CALCULATOR_NAV
    .filter((c) => c.subItems?.some((s) => pathname === s.path))
    .map((c) => c.name);
}

function getPageTitle(pathname) {
  if (pathname === '/') return 'Home';
  const match = PAGE_TITLES.find((p) => pathname.startsWith(p.path));
  return match ? match.title : 'TempWorks';
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);

  // Expandable calculator groups — start open when the current route is
  // inside them, and auto-expand when navigating into one.
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(groupsContaining(location.pathname).map((name) => [name, true]))
  );

  const toggleGroup = (name) =>
    setOpenGroups((prev) => ({ ...prev, [name]: !prev[name] }));

  useEffect(() => {
    const active = groupsContaining(location.pathname);
    if (active.length === 0) return;
    setOpenGroups((prev) => {
      if (active.every((name) => prev[name])) return prev;
      const next = { ...prev };
      active.forEach((name) => { next[name] = true; });
      return next;
    });
  }, [location.pathname]);

  // Close sidebar on route change (mobile nav tap)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleClearCache = async () => {
    // Calculator working state and the stale-bundle reload guards all live in
    // sessionStorage, so this is the whole of the app's throwaway state
    sessionStorage.clear();

    // localStorage is deliberately left alone. It holds only the open project
    // and which .tw file it came from — work, not cache. This used to wipe
    // localStorage and restore an allowlist of keys worth keeping, which meant
    // any key the allowlist had not been told about was silently destroyed;
    // adding a new key elsewhere in the app was enough to lose data here.

    // Service worker / browser caches — the actual cache
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
    // Hard reload bypassing cache
    window.location.reload(true);
  };

  const navItems = [
    { name: 'Projects', path: '/projects', icon: FolderOpen },
    { name: 'Project Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const calculators = CALCULATOR_NAV;

  return (
    <div className={styles.layoutContainer}>
      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} />
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className={styles.overlay}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <Logo width={160} light={true} />
          </Link>
          {/* Close button visible only on mobile */}
          <button
            className={styles.sidebarCloseBtn}
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>
        <nav className={styles.navLinks}>
          {navItems.map((item) => (
            <Link 
              key={item.name} 
              to={item.path} 
              className={`${styles.navLink} ${location.pathname.startsWith(item.path) ? styles.active : ''}`}
            >
              <item.icon className={styles.navIcon} size={20} />
              {item.name}
            </Link>
          ))}
          
          <div className={styles.navSection}>
            <span className={styles.navSectionTitle}>CALCULATORS</span>
            {calculators.map((calc) => (
              calc.active ? (
                calc.subItems ? (
                  <div key={calc.name} className={styles.navGroup}>
                    <button
                      type="button"
                      className={`${styles.navGroupHeader} ${calc.subItems.some((s) => location.pathname === s.path) ? styles.groupActive : ''}`}
                      onClick={() => toggleGroup(calc.name)}
                      aria-expanded={!!openGroups[calc.name]}
                    >
                      <calc.icon className={styles.navIcon} size={20} />
                      {calc.name}
                      <ChevronDown
                        size={16}
                        className={`${styles.groupChevron} ${openGroups[calc.name] ? styles.groupChevronOpen : ''}`}
                      />
                    </button>
                    <div className={`${styles.navSubItemsWrap} ${openGroups[calc.name] ? styles.navSubItemsWrapOpen : ''}`}>
                      <div className={styles.navSubItems}>
                        {calc.subItems.map(sub => (
                          <Link
                            key={sub.name}
                            to={sub.path}
                            className={`${styles.navSubLink} ${location.pathname === sub.path ? styles.active : ''}`}
                            tabIndex={openGroups[calc.name] ? 0 : -1}
                          >
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link 
                    key={calc.name} 
                    to={calc.path} 
                    className={`${styles.navLink} ${location.pathname.startsWith(calc.path) ? styles.active : ''}`}
                  >
                    <calc.icon className={styles.navIcon} size={20} />
                    {calc.name}
                  </Link>
                )
              ) : (
                <div key={calc.name} className={`${styles.navLink} ${styles.disabled}`} title="Work in Progress / Upcoming Update">
                  <calc.icon className={styles.navIcon} size={20} />
                  {calc.name}
                </div>
              )
            ))}
          </div>

          {/* Clear Cache & Reload */}
          <div className={styles.navSection}>
            <button
              className={styles.sidebarActionBtn}
              onClick={() => setIsTermsOpen(true)}
              title="View Terms & Conditions"
            >
              <ShieldCheck size={15} />
              Terms & Conditions
            </button>
            <button
              className={styles.clearCacheBtn}
              onClick={handleClearCache}
              title="Clear all cached data and reload the app"
            >
              <RefreshCw size={15} />
              Clear Cache &amp; Reload
            </button>
          </div>
        </nav>

        {/* Credit & version */}
        <div className={styles.sidebarFooter}>
          {user && (
            <div className={styles.userInfo}>
              <span className={styles.userEmail}>{user.email}</span>
              {user.role && <span className={styles.userRole}>{user.role}</span>}
              <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
                <LogOut size={15} /> Log out
              </button>
            </div>
          )}
          <span className={styles.devCredit}>Developed by: Henry Lee | 2026</span>
          <span className={styles.versionTag}>Version 0.35 (Beta)</span>
        </div>
      </aside>
      
      <div className={styles.mainWrapper}>
        <header className={styles.topHeader}>
          {/* Hamburger button – visible only on mobile */}
          <button
            className={styles.hamburgerBtn}
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          {/* Current page title – fills the otherwise-empty mobile header */}
          <h1 className={styles.headerTitle}>{getPageTitle(location.pathname)}</h1>
        </header>

        <main className={styles.mainContent}>
          <div key={location.pathname} className={styles.pageEnter}>
            <Suspense fallback={<RouteLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
