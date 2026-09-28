import { useState, useEffect } from 'react';
import { menfesAPI } from '../api';

function formatDate(iso) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export default function MenfesCard() {
  const [menfes, setMenfes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    loadMenfes(1);
  }, []);

  async function loadMenfes(p) {
    setLoading(true);
    try {
      const { data } = await menfesAPI.getApproved(p);
      if (p === 1) {
        setMenfes(data.data);
      } else {
        setMenfes((prev) => [...prev, ...data.data]);
      }
      setPagination(data.pagination);
      setPage(p);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-800" />
        <h3 className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
          Menfess Terbaru
        </h3>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      {loading && menfes.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
              <div className="h-4 bg-zinc-800 rounded w-1/2" />
              <div className="h-3 bg-zinc-800 rounded w-1/4 mt-3" />
            </div>
          ))}
        </div>
      ) : menfes.length === 0 ? (
        <div className="card text-center py-10">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm text-zinc-500 font-mono">Belum ada menfess yang disetujui.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {menfes.map((item) => (
              <article key={item.id} className="card hover:border-zinc-700 transition-colors">
                {/* Tanda kutip dekoratif */}
                <span className="text-brand-700 text-4xl font-serif leading-none select-none">"</span>
                <p className="text-zinc-200 leading-relaxed text-sm whitespace-pre-wrap font-mono -mt-2">
                  {item.message}
                </p>
                <p className="text-xs text-zinc-600 mt-3 font-mono">
                  {formatDate(item.approvedAt || item.createdAt)}
                </p>
              </article>
            ))}
          </div>

          {pagination && page < pagination.totalPages && (
            <button
              onClick={() => loadMenfes(page + 1)}
              disabled={loading}
              className="btn-secondary w-full text-sm font-mono tracking-wider"
            >
              {loading ? 'MEMUAT...' : 'LIHAT LEBIH BANYAK'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
