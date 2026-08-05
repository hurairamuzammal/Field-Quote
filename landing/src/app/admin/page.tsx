'use client';

import { motion } from 'framer-motion';
import { LayoutDashboard, Users, CreditCard, Settings, Search, Plus, MoreVertical, FileText, ChevronRight } from 'lucide-react';
import Logo from '@/components/Logo';
import Link from 'next/link';
import { useState } from 'react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)', color: 'var(--text-dark)' }}>
      
      {/* Sidebar */}
      <aside style={{
        width: '280px',
        background: 'var(--lime)',
        color: 'var(--dark-green)',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '2.5rem',
        borderRight: '1px solid rgba(11,29,44,0.1)',
        position: 'fixed',
        height: '100vh',
        left: 0,
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Logo color="var(--dark-green)" size={28} />
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<FileText size={20} />} label="Orders" isActive={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <NavItem icon={<Users size={20} />} label="Technicians" isActive={activeTab === 'technicians'} onClick={() => setActiveTab('technicians')} />
          <NavItem icon={<CreditCard size={20} />} label="Price Book" isActive={activeTab === 'pricebook'} onClick={() => setActiveTab('pricebook')} />
        </nav>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <NavItem icon={<Settings size={20} />} label="Company Settings" isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, marginLeft: '280px', padding: '3rem 4rem' }}>
        
        {/* Topbar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-h3)', marginBottom: '0.2rem' }}>Overview<span style={{ color: 'var(--lime)' }}>.</span></h1>
            <p style={{ color: 'rgba(0,0,0,0.5)', fontSize: 'var(--text-sm)' }}>Welcome back, Admin. Here is what is happening today.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,0,0,0.4)' }} />
              <input 
                type="text" 
                placeholder="Search orders, techs..." 
                style={{
                  padding: '0.8rem 1rem 0.8rem 2.8rem',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid var(--border-light)',
                  background: '#fff',
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                  width: '280px'
                }} 
              />
            </div>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.8rem 1.5rem',
                background: 'var(--lime)',
                color: 'var(--dark-green)',
                border: 'none',
                borderRadius: 'var(--radius-pill)',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,224,196,0.3)'
              }}
            >
              <Plus size={18} color="var(--dark-green)" /> Create Quote
            </motion.button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid-3x3" style={{ marginBottom: '3rem' }}>
          <StatCard title="Active Orders" value="24" trend="+12% this week" color="var(--lime)" />
          <StatCard title="Unassigned Jobs" value="7" trend="Requires attention" color="#FF5A5F" />
          <StatCard title="Available Techs" value="12 / 15" trend="3 currently dispatched" color="var(--dark-green)" />
        </div>

        {/* Recent Orders Table */}
        <section style={{ 
          background: '#fff', 
          borderRadius: 'var(--radius-lg)', 
          border: '1px solid var(--border-light)',
          padding: '2rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-large)' }}>Recent Orders</h2>
            <Link href="#" style={{ color: 'var(--dark-green)', fontSize: 'var(--text-sm)', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
              View all <ChevronRight size={16} color="var(--lime)" style={{ marginLeft: '0.2rem' }} />
            </Link>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-light)', color: 'rgba(0,0,0,0.5)', fontSize: 'var(--text-sm)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ paddingBottom: '1rem', fontWeight: 600 }}>Order ID</th>
                <th style={{ paddingBottom: '1rem', fontWeight: 600 }}>Client</th>
                <th style={{ paddingBottom: '1rem', fontWeight: 600 }}>Service</th>
                <th style={{ paddingBottom: '1rem', fontWeight: 600 }}>Status</th>
                <th style={{ paddingBottom: '1rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <TableRow id="ORD-0092" client="Sarah Jenkins" service="Consumer Unit Upgrade" status="AI Drafted" statusColor="#FFC107" />
              <TableRow id="ORD-0091" client="Michael Scott" service="EICR Certificate" status="Deposit Paid" statusColor="var(--lime)" />
              <TableRow id="ORD-0090" client="Emily Blunt" service="EV Charger Install" status="Scheduled" statusColor="#2196F3" />
              <TableRow id="ORD-0089" client="Tom Hardy" service="Fault Finding" status="Completed" statusColor="var(--dark-green)" />
            </tbody>
          </table>
        </section>

      </main>
    </div>
  );
}

// --- Subcomponents ---

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.8rem 1rem',
        background: isActive ? 'rgba(11, 29, 44, 0.1)' : 'transparent',
        color: isActive ? 'var(--dark-green)' : 'rgba(11,29,44,0.6)',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-body)',
        fontWeight: isActive ? 800 : 600,
        fontSize: '0.95rem',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s',
        position: 'relative'
      }}
    >
      {isActive && <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '3px', background: 'var(--dark-green)', borderRadius: '0 4px 4px 0' }} />}
      {icon}
      {label}
    </button>
  );
}

function StatCard({ title, value, trend, color }: { title: string, value: string, trend: string, color: string }) {
  return (
    <div style={{
      background: '#fff',
      padding: '2rem',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-light)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }}>
      <div style={{ color: 'rgba(0,0,0,0.5)', fontSize: 'var(--text-sm)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800, color: 'var(--dark-green)', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.85rem', color: color, fontWeight: 600, marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: color }} />
        {trend}
      </div>
    </div>
  );
}

function TableRow({ id, client, service, status, statusColor }: { id: string, client: string, service: string, status: string, statusColor: string }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
      <td style={{ padding: '1.2rem 0', fontWeight: 600, fontFamily: 'var(--font-display)', fontSize: '0.95rem' }}>{id}</td>
      <td style={{ padding: '1.2rem 0', color: 'rgba(0,0,0,0.8)' }}>{client}</td>
      <td style={{ padding: '1.2rem 0', color: 'rgba(0,0,0,0.6)' }}>{service}</td>
      <td style={{ padding: '1.2rem 0' }}>
        <span style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '0.4rem', 
          padding: '0.3rem 0.8rem', 
          background: 'rgba(0,0,0,0.03)', 
          borderRadius: 'var(--radius-pill)',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: 'var(--text-dark)'
        }}>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: statusColor }} />
          {status}
        </span>
      </td>
      <td style={{ padding: '1.2rem 0', textAlign: 'right' }}>
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)' }}>
          <MoreVertical size={20} />
        </button>
      </td>
    </tr>
  );
}
