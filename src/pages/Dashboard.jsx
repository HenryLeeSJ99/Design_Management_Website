import { useAuth } from '../contexts/AuthContext';
import styles from './Dashboard.module.css';
import { FolderOpen, LayoutTemplate, Calculator, Clock, Construction } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function Dashboard() {
  const { currentUser } = useAuth();

  const chartData = {
    labels: ['Beam Form', 'Wall Form', 'Shoring Tower', 'Slab Form', 'Props'],
    datasets: [
      {
        data: [25, 12, 8, 15, 6],
        backgroundColor: [
          '#1d4ed8', // blue-700
          '#3b82f6', // blue-500
          '#60a5fa', // blue-400
          '#93c5fd', // blue-300
          '#bfdbfe', // blue-200
        ],
        borderWidth: 0,
      },
    ],
  };

  const chartOptions = {
    cutout: '75%',
    plugins: {
      legend: {
        position: 'right',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            family: "'Inter', sans-serif",
            size: 12
          }
        }
      }
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.headerTitle}>Dashboard</h1>
          <p className={styles.headerSubtitle}>Welcome back, {currentUser?.email?.split('@')[0] || 'Engineer'}</p>
        </div>
      </header>

      <div className={styles.contentWrapper}>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Projects</h3>
              <FolderOpen size={20} className={styles.statIcon} />
            </div>
            <p className={styles.statValue}>18</p>
            <p className={styles.statLabel}>Active Projects</p>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Design Cases</h3>
              <LayoutTemplate size={20} className={styles.statIcon} />
            </div>
            <p className={styles.statValue}>56</p>
            <p className={styles.statLabel}>Total Cases</p>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Calculations</h3>
              <Calculator size={20} className={styles.statIcon} />
            </div>
            <p className={styles.statValue}>132</p>
            <p className={styles.statLabel}>Total Calculations</p>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Pending Review</h3>
              <Clock size={20} className={styles.statIcon} />
            </div>
            <p className={styles.statValue}>8</p>
            <p className={styles.statLabel}>Cases</p>
          </div>
        </div>

        <div className={styles.bottomGrid}>
          <div className={styles.recentProjects}>
            <div className={styles.sectionHeader}>
              <h2>Recent Projects</h2>
              <button className={styles.viewAllBtn}>View all</button>
            </div>
            <div className={styles.listCard}>
              <div className={styles.listHeader}>
                <span>Project Name</span>
                <span>Client</span>
                <span>Updated</span>
              </div>
              <div className={styles.listItem}>
                <span className={styles.primaryText}>KL Eco City Tower</span>
                <span>Eco City Sdn Bhd</span>
                <span className={styles.statusSuccess}>In Progress</span>
              </div>
              <div className={styles.listItem}>
                <span className={styles.primaryText}>Penang Logistics Hub</span>
                <span>LogiBuild Sdn Bhd</span>
                <span className={styles.statusSuccess}>In Progress</span>
              </div>
              <div className={styles.listItem}>
                <span className={styles.primaryText}>Johor Industrial Park</span>
                <span>JLand Group</span>
                <span className={styles.statusSuccess}>In Progress</span>
              </div>
              <div className={styles.listItem}>
                <span className={styles.primaryText}>MRT3 Package C</span>
                <span>Mass Rapid Transit Corp</span>
                <span className={styles.statusWarning}>Review</span>
              </div>
            </div>
          </div>

          <div className={styles.chartSection}>
            <div className={styles.sectionHeader}>
              <h2>Design Cases by Type</h2>
            </div>
            <div className={styles.chartCard}>
              <Doughnut data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Work In Progress Overlay */}
        <div className={styles.wipOverlay}>
          <div className={styles.wipCard}>
            <div className={styles.wipIconWrapper}>
              <Construction size={40} className={styles.wipIcon} />
            </div>
            <h2 className={styles.wipTitle}>Dashboard Coming Soon</h2>
            <p className={styles.wipDescription}>
              We're currently building a powerful dashboard interface to provide real-time project statistics, active design tracking, and material utilization insights.
            </p>
            <span className={styles.wipBadge}>Upcoming Feature</span>
          </div>
        </div>
      </div>
    </div>
  );
}
