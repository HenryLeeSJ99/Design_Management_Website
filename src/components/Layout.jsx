import { useState, useEffect, Suspense } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import styles from './Layout.module.css';
import Logo from './Logo';
import RouteLoader from './RouteLoader';
import { Menu, X, SquareMenu, Layers, Building, ChevronsUp, Columns, Cuboid, RefreshCw } from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile nav tap)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleClearCache = async () => {
    // Clear sessionStorage (calculator state)
    sessionStorage.clear();
    // Clear localStorage
    localStorage.clear();
    // Clear all service worker / browser caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    // Hard reload bypassing cache
    window.location.reload(true);
  };

  const navItems = [];

  const calculators = [
    { name: 'Multi Beam Span', path: '/calculators/multi-beam', icon: SquareMenu, active: true },
    { name: 'Slab Formwork', path: '/calculators/slab-formwork', icon: Layers, active: true },
    { 
      name: 'Wall Formwork', 
      icon: Building, 
      active: true,
      subItems: [
        { name: 'Concrete Pressure', path: '/calculators/wall-formwork' }
      ]
    },
    { name: 'Shoring Tower', path: '/calculators/shoring-tower', icon: ChevronsUp, active: true },
    { name: 'Column Formwork', path: '#', icon: Columns, active: false },
    { name: 'Beam Formwork', path: '#', icon: Cuboid, active: false },
  ];

  return (
    <div className={styles.layoutContainer}>
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
                    <div className={styles.navGroupHeader}>
                      <calc.icon className={styles.navIcon} size={20} />
                      {calc.name}
                    </div>
                    <div className={styles.navSubItems}>
                      {calc.subItems.map(sub => (
                        <Link 
                          key={sub.name} 
                          to={sub.path} 
                          className={`${styles.navSubLink} ${location.pathname === sub.path ? styles.active : ''}`}
                        >
                          {sub.name}
                        </Link>
                      ))}
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
              className={styles.clearCacheBtn}
              onClick={handleClearCache}
              title="Clear all cached data and reload the app"
            >
              <RefreshCw size={15} />
              Clear Cache &amp; Reload
            </button>
          </div>
        </nav>
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
