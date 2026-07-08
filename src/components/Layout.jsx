import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styles from './Layout.module.css';
import Logo from './Logo';
import { LayoutDashboard, LogOut, Search, Bell, SquareMenu, Layers, Building, ChevronsUp, Columns, Cuboid } from 'lucide-react';

export default function Layout() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();

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
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Logo width={160} light={true} />
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
