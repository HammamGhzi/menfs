import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { adminAPI } from '../api';
import ExportModal from '../components/ExportModal';

const STATUS_TABS = [
  { key: 'PENDING',  label: 'Menunggu',  emoji: '⏳', color: 'text-amber-400' },
  { key: 'APPROVED', label: 'Disetujui', emoji: '✅', color: 'text-emerald-400' },
  { key: 'REJECTED', label: 'Ditolak',   emoji: '❌', color: 'text-red-400' },
];

function formatDate(iso) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export default function AdminDashboardPage() {
  const { admin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('PENDING');
  const [menfes, setMenfes] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [exportTarget, setExportTarget] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, menfesRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getMenfes(activeTab),
      ]);
      setStats(statsRes.data);
      setMenfes(menfesRes.data.data);
    } catch {
      toast.error('Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleApprove(id) {
    setActionLoading(id + '_approve');
    try {
      await adminAPI.approve(id);
      toast.success('Menfess diapprove! ✅');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal approve.');
    } finally { setActionLoading(null); }
  }

  async function handleReject(id) {
    setActionLoading(id + '_reject');
    try {
      await adminAPI.reject(id);
      toast.success('Menfess direject.');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal reject.');
    } finally { setActionLoading(null); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Yakin hapus menfess ini secara permanen?')) return;
    setActionLoading(id + '_delete');
    try {
      await adminAPI.delete(id);
      toast.success('Menfess dihapus.');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gagal menghapus.');
    } finally { setActionLoading(null); }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Topbar */}
      <header className="bg-zinc-950 border-b border-zinc-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-extrabold text-white tracking-tight">
              HARKAT <span className="text-brand-600">NEKATT</span>
            </h1>
            <p className="text-xs text-zinc-500 font-mono">DASHBOARD ADMIN</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500 hidden sm:block font-mono">
              {admin?.username}
            </span>
            <button
              onClick={logout}
              className="text-xs text-red-500 hover:text-red-400 font-mono font-semibold transition-colors"
            >
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'TOTAL',     value: stats.total,    bg: 'bg-zinc-800',    text: 'text-white' },
            { label: 'MENUNGGU',  value: stats.pending,  bg: 'bg-amber-900/60', text: 'text-amber-300' },
            { label: 'DISETUJUI', value: stats.approved, bg: 'bg-emerald-900/60', text: 'text-emerald-300' },
            { label: 'DITOLAK',   value: stats.rejected, bg: 'bg-red-900/60',   text: 'text-red-300' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-2xl border border-zinc-800 p-4 text-center`}>
              <div className={`text-3xl font-extrabold ${s.text}`}>{s.value}</div>
              <div className="text-xs text-zinc-500 font-mono mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 rounded-2xl p-1 border border-zinc-800">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-mono font-semibold tracking-wider transition-all ${
                activeTab === tab.key
                  ? 'bg-brand-700 text-white'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {tab.emoji} {tab.label.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <div className="flex justify-end">
          <button
            onClick={loadData}
            disabled={loading}
            className="text-xs text-zinc-500 hover:text-white font-mono flex items-center gap-1.5 transition-colors"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            REFRESH
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
                <div className="h-4 bg-zinc-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : menfes.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-zinc-500 font-mono text-sm">Tidak ada menfess di kategori ini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {menfes.map((item) => (
              <div key={item.id} className="card space-y-3 hover:border-zinc-700 transition-colors">
                {/* Pesan */}
                <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap font-mono text-sm">
                  "{item.message}"
                </p>

                {/* Info pengirim (admin only) */}
                {(item.senderName || item.senderInfo) && (
                  <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 space-y-1">
                    <p className="text-xs font-mono font-semibold text-zinc-400">🔒 INFO PENGIRIM</p>
                    {item.senderName && (
                      <p className="text-sm text-zinc-300 font-mono">Nama: <span className="text-white">{item.senderName}</span></p>
                    )}
                    {item.senderInfo && (
                      <p className="text-sm text-zinc-300 font-mono">Info: {item.senderInfo}</p>
                    )}
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center gap-3 text-xs text-zinc-600 font-mono flex-wrap">
                  <span>🕐 {formatDate(item.createdAt)}</span>
                  {item.approvedAt && <span>✅ {formatDate(item.approvedAt)}</span>}
                </div>

                {/* Aksi */}
                <div className="flex gap-2 flex-wrap pt-2 border-t border-zinc-800">
                  {item.status !== 'APPROVED' && (
                    <button
                      onClick={() => handleApprove(item.id)}
                      disabled={!!actionLoading}
                      className="btn-success text-xs py-1.5 px-3 font-mono"
                    >
                      {actionLoading === item.id + '_approve' ? '...' : '✅ APPROVE'}
                    </button>
                  )}
                  {item.status !== 'REJECTED' && (
                    <button
                      onClick={() => handleReject(item.id)}
                      disabled={!!actionLoading}
                      className="btn-danger text-xs py-1.5 px-3 font-mono"
                    >
                      {actionLoading === item.id + '_reject' ? '...' : '❌ REJECT'}
                    </button>
                  )}
                  {item.status === 'APPROVED' && (
                    <button
                      onClick={() => setExportTarget(item)}
                      className="bg-zinc-700 hover:bg-zinc-600 text-white text-xs py-1.5 px-3 rounded-lg font-mono font-semibold transition-colors"
                    >
                      📸 EXPORT IG
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={!!actionLoading}
                    className="ml-auto text-xs text-zinc-600 hover:text-red-400 transition-colors font-mono"
                  >
                    🗑️ HAPUS
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {exportTarget && (
        <ExportModal menfes={exportTarget} onClose={() => setExportTarget(null)} />
      )}
    </div>
  );
}
