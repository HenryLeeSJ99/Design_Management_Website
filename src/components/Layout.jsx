import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './Layout.module.css';
import Logo from './Logo';
import { LayoutDashboard, LogOut, Search, Bell, Menu, X, SquareMenu, Layers, Building, ChevronsUp, Columns, Cuboid, Save, FolderOpen } from 'lucide-react';

export default function Layout() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile nav tap)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  ];

  const calculators = [
    { name: 'Multi Beam Span', path: '/calculators/multi-beam', icon: SquareMenu, active: true },
    { name: 'Slab Formwork', path: '/calculators/slab-formwork', icon: Layers, active: true },
    { name: 'Wall Formwork', path: '#', icon: Building, active: false },
    { name: 'Shoring Tower', path: '#', icon: ChevronsUp, active: false },
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
          <Logo width={160} light={true} />
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
                <Link 
                  key={calc.name} 
                  to={calc.path} 
                  className={`${styles.navLink} ${location.pathname.startsWith(calc.path) ? styles.active : ''}`}
                >
                  <calc.icon className={styles.navIcon} size={20} />
                  {calc.name}
                </Link>
              ) : (
                <div key={calc.name} className={`${styles.navLink} ${styles.disabled}`} title="Work in Progress / Upcoming Update">
                  <calc.icon className={styles.navIcon} size={20} />
                  {calc.name}
                </div>
              )
            ))}
          </div>

          {/* Mobile-only: Project & Save actions */}
          <div className={styles.navSection + ' ' + styles.mobileProjectSection}>
            <span className={styles.navSectionTitle}>PROJECT</span>
            <div className={styles.mobileProjectSelect}>
              <FolderOpen size={16} className={styles.navIcon} />
              <select>
                <option>Hospital Block A - Level 3</option>
              </select>
            </div>
            <button className={styles.mobileActionBtn}>
              <Save size={16} />
              Save
            </button>
          </div>
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <span className={styles.userEmail}>{currentUser?.email || 'Engineer'}</span>
            <span className={styles.userRole}>{currentUser?.role || 'Engineer'}</span>
          </div>
          <button className={styles.logoutBtn} onClick={logout}>
            <LogOut size={16} />
            Sign Out
          </button>
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
          <div className={styles.searchBar}>
            <Search className={styles.searchIcon} size={18} />
            <input type="text" placeholder="Search projects or calculations..." />
          </div>
          <div className={styles.headerRight}>
            <button className={styles.iconBtn}><Bell size={20} /></button>
            <div className={styles.avatar}>{currentUser?.email?.charAt(0).toUpperCase() || 'E'}</div>
          </div>
        </header>

        <main className={styles.mainContent}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
