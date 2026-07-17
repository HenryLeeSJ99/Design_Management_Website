import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchProjects } from '../services/supabaseDb';
import { readSubmissions, submissionComplete, MILESTONES } from '../services/projectTimeline';
import { useAuth } from '../contexts/AuthContext';
import styles from './Overview.module.css';
import RouteLoader from '../components/RouteLoader';
import { 
  TrendingUp, 
  Calculator, 
  FolderOpen, 
  FileText, 
  Clock, 
  Trophy, 
  User, 
  Award, 
  Activity,
  Layers
} from 'lucide-react';

// Preset avatar colors for rendering visually rich team listings
const AVATAR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
];

export default function Overview() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('designers'); // 'designers' | 'leaders' | 'managers'

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await fetchProjects();
        setProjects(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute master stats
  const stats = useMemo(() => {
    const activeProjects = projects.filter(p => p.status === 'active');
    
    // Sum calculations and drawings
    const totalCalculations = projects.reduce((sum, p) => sum + (p.calculation_count || 0), 0);
    const totalDrawings = projects.reduce((sum, p) => sum + (p.drawing_count || 0), 0);
    
    // Sum total file sizes (default to 12KB if missing)
    const totalSizeBytes = projects.reduce((sum, p) => sum + (p.file_size || 12000), 0);
    const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);

    // Sum up zones and completions
    let totalZones = 0;
    let completedZones = 0;
    projects.forEach(p => {
      const submissions = readSubmissions(p);
      totalZones += submissions.length;
      completedZones += submissions.filter(submissionComplete).length;
    });

    const completionRate = totalZones > 0 ? Math.round((completedZones / totalZones) * 100) : 0;

    return {
      activeProjectsCount: activeProjects.length,
      totalCalculations,
      totalDrawings,
      totalSizeMB,
      totalZones,
      completedZones,
      completionRate
    };
  }, [projects]);

  // Aggregate user statistics dynamically from database
  const leaderboardData = useMemo(() => {
    // 1. Group calculations by updater_email to get Designer rankings
    const dbDesignerStats = {};
    projects.forEach(p => {
      const email = p.updater_email || p.updater_id || 'system@plytec.com';
      if (!dbDesignerStats[email]) {
        dbDesignerStats[email] = { email, count: 0, projectsCount: 0 };
      }
      dbDesignerStats[email].count += (p.calculation_count || 0);
      dbDesignerStats[email].projectsCount += 1;
    });

    const designerList = Object.values(dbDesignerStats).map((dbUser, index) => {
      const parsedName = dbUser.email.split('@')[0]
        .replace(/[^a-zA-Z]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      
      return {
        name: parsedName,
        email: dbUser.email,
        score: dbUser.count,
        badge: dbUser.count > 10 ? 'Senior Engineer' : 'Design Associate',
        colorIndex: index % AVATAR_COLORS.length
      };
    });

    // Sort by calculations score descending
    designerList.sort((a, b) => b.score - a.score);

    // 2. Team Leaders ranking (group by creator / updater, summing drawing counts)
    const dbLeaderStats = {};
    projects.forEach(p => {
      const email = p.updater_email || p.updater_id || 'system@plytec.com';
      if (!dbLeaderStats[email]) {
        dbLeaderStats[email] = { email, count: 0 };
      }
      dbLeaderStats[email].count += (p.drawing_count || 0);
    });

    const leaderList = Object.values(dbLeaderStats)
      .filter(l => l.count > 0)
      .map((dbUser, index) => {
        const parsedName = dbUser.email.split('@')[0]
          .replace(/[^a-zA-Z]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());

        return {
          name: parsedName,
          email: dbUser.email,
          score: dbUser.count,
          badge: 'Design Auditor',
          colorIndex: index % AVATAR_COLORS.length
        };
      });

    leaderList.sort((a, b) => b.score - a.score);

    // 3. Managers ranking (group by creator / updater, counting project volumes managed)
    const dbManagerStats = {};
    projects.forEach(p => {
      const email = p.updater_email || p.updater_id || 'system@plytec.com';
      if (!dbManagerStats[email]) {
        dbManagerStats[email] = { email, count: 0 };
      }
      dbManagerStats[email].count += 1; // Projects volume managed
    });

    const managerList = Object.values(dbManagerStats).map((dbUser, index) => {
      const parsedName = dbUser.email.split('@')[0]
        .replace(/[^a-zA-Z]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

      return {
        name: parsedName,
        email: dbUser.email,
        score: dbUser.count,
        badge: 'Project Manager',
        colorIndex: index % AVATAR_COLORS.length
      };
    });

    managerList.sort((a, b) => b.score - a.score);

    return {
      designers: designerList,
      leaders: leaderList,
      managers: managerList
    };
  }, [projects]);

  // Extract all completed milestones chronologically for the activity timeline
  const timelineEvents = useMemo(() => {
    const events = [];

    projects.forEach(p => {
      const submissions = readSubmissions(p);
      submissions.forEach(sub => {
        sub.milestones.forEach(m => {
          if (m.doneAt) {
            events.push({
              id: `${p.id}-${sub.zoneId}-${m.key}`,
              projectId: p.id,
              projectName: p.name,
              zoneName: sub.zoneName,
              milestoneLabel: m.label,
              doneAt: new Date(m.doneAt),
              updater: p.updater_email || 'system@plytec.com'
            });
          }
        });
      });
    });

    // Sort by timestamp descending
    return events.sort((a, b) => b.doneAt - a.doneAt);
  }, [projects]);

  // Relative time helper
  const getRelativeTime = (date) => {
    const diffMs = new Date() - date;
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  if (loading) return <RouteLoader full />;

  if (error) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', padding: '3rem', color: '#dc2626' }}>
          <h3>Failed to Load Overview</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Determine current active leaderboard array
  const activeLeaderboard = leaderboardData[activeTab];

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.headerBlock}>
        <h1 className={styles.title}>System Overview</h1>
        <p className={styles.subtitle}>Master project portfolio metrics, real-time activity timelines, and designer productivity rankings.</p>
      </div>

      {/* Bento Grid Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.iconWrapper}>
            <FolderOpen size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Active Projects</span>
            <span className={styles.statValue}>{stats.activeProjectsCount}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.iconWrapper}>
            <Calculator size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Calculations Run</span>
            <span className={styles.statValue}>{stats.totalCalculations}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.iconWrapper}>
            <FileText size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Drawings Checked</span>
            <span className={styles.statValue}>{stats.totalDrawings}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.iconWrapper}>
            <Layers size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Zone Completion</span>
            <span className={styles.statValue}>
              {stats.completionRate}% <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>({stats.completedZones}/{stats.totalZones})</span>
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.iconWrapper}>
            <TrendingUp size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Engineering Weight</span>
            <span className={styles.statValue}>{stats.totalSizeMB} <span style={{ fontSize: '11px', fontWeight: 500 }}>MB</span></span>
          </div>
        </div>
      </div>

      {/* Grid Dashboard Body */}
      <div className={styles.dashboardBody}>
        {/* Left Column: Master Timeline */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <Activity size={18} /> Master Project Activity Feed
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>LIVE WEBSOCKET BROADCAST</span>
          </div>
          <div className={styles.cardContent}>
            {timelineEvents.length === 0 ? (
              <div className={styles.noTimeline}>
                <Clock size={36} />
                <span>No active submissions logged in database yet.</span>
              </div>
            ) : (
              <div className={styles.timelineScroll}>
                <div className={styles.timelineTrack}>
                  {timelineEvents.map((evt) => (
                    <div key={evt.id} className={styles.timelineItem}>
                      <div className={styles.timelineNode} />
                      <div className={styles.timelineMeta}>
                        <span className={styles.timelineTime}>{getRelativeTime(evt.doneAt)}</span>
                        <span>•</span>
                        <span className={styles.timelineEmail}>{evt.updater}</span>
                      </div>
                      <div className={styles.timelineText}>
                        {evt.projectId ? (
                          <Link to={`/projects/${evt.projectId}`} className={styles.timelineProject}>
                            {evt.projectName}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{evt.projectName}</span>
                        )}{' '}
                        (Zone: <strong>{evt.zoneName}</strong>) reached{' '}
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{evt.milestoneLabel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Leaderboard / Rankings */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>
              <Trophy size={18} /> Team Leaderboard
            </span>
            
            {/* Filter tab selector */}
            <div className={styles.tabGroup}>
              <button 
                onClick={() => setActiveTab('designers')}
                className={`${styles.tabBtn} ${activeTab === 'designers' ? styles.tabBtnActive : ''}`}
              >
                Designers
              </button>
              <button 
                onClick={() => setActiveTab('leaders')}
                className={`${styles.tabBtn} ${activeTab === 'leaders' ? styles.tabBtnActive : ''}`}
              >
                Auditors
              </button>
              <button 
                onClick={() => setActiveTab('managers')}
                className={`${styles.tabBtn} ${activeTab === 'managers' ? styles.tabBtnActive : ''}`}
              >
                Managers
              </button>
            </div>
          </div>
          
          <div className={styles.cardContent}>
            <div className={styles.leaderboardList}>
              {activeLeaderboard.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  <User size={32} style={{ marginBottom: '8px', opacity: 0.5, display: 'block', margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>No entries recorded yet</div>
                </div>
              ) : (
                activeLeaderboard.map((member, idx) => {
                  const isFirst = idx === 0;
                  const isSecond = idx === 1;
                  const isThird = idx === 2;
                  const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  const avatarColor = AVATAR_COLORS[member.colorIndex || 0];

                  // Calculate progress bar percent (max score relative reference)
                  const maxScore = activeLeaderboard[0]?.score || 100;
                  const progressPct = maxScore > 0 ? (member.score / maxScore) * 100 : 0;

                  return (
                    <div key={member.email} className={styles.leaderboardRow}>
                      {/* Rank Number Badge */}
                      <div className={`${styles.rankBadge} ${isFirst ? styles.rank1 : isSecond ? styles.rank2 : isThird ? styles.rank3 : ''}`}>
                        {idx + 1}
                      </div>

                      {/* Designer Initials Avatar */}
                      <div className={styles.avatar} style={{ backgroundColor: avatarColor }}>
                        {initials}
                      </div>

                      {/* Member Details */}
                      <div className={styles.rowDetails}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className={styles.rowName}>{member.name}</span>
                          <span className={`${styles.badge} ${activeTab === 'leaders' ? styles.badgeLeader : activeTab === 'managers' ? styles.badgeManager : ''}`}>
                            {member.badge}
                          </span>
                        </div>
                        <span className={styles.rowEmail}>{member.email}</span>
                        
                        {/* Bar indicator */}
                        <div className={styles.rowProgress}>
                          <div 
                            className={styles.rowProgressBar} 
                            style={{ 
                              width: `${progressPct}%`,
                              backgroundColor: isFirst ? 'var(--primary)' : 'var(--text-muted)'
                            }} 
                          />
                        </div>
                      </div>

                      {/* Calculations count score */}
                      <div className={styles.rowScore}>
                        <span className={styles.scoreValue}>{member.score}</span>
                        <span className={styles.scoreLabel}>
                          {activeTab === 'designers' ? 'calcs' : activeTab === 'leaders' ? 'checks' : 'milestones'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
