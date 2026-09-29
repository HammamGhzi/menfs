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
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-ink-600" />
        <h3 className="font-mono text-xs text-ink-400 uppercase tracking-[0.2em] sm:tracking-[0.25em] shrink-0">
          Menfess Terbaru
        </h3>
        <div className="h-px flex-1 bg-ink-600" />
      </div>

      {loading && menfes.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card border-ink-600 animate-pulse p-4 sm:p-6">
              <div className="h-4 bg-ink-600 rounded w-3/4 mb-2" />
              <div className="h-4 bg-ink-600 rounded w-1/2" />
              <div className="h-3 bg-ink-600 rounded w-1/4 mt-3" />
            </div>
          ))}
        </div>
      ) : menfes.length === 0 ? (
        <div className="card text-center py-10 border-ink-600">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm text-ink-400 font-mono">Belum ada menfess yang disetujui.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {menfes.map((item) => (
              <article
                key={item.id}
                className="card border-ink-600 hover:border-brand-800/50 transition-colors group p-4 sm:p-6"
              >
                {/* Tanda kutip kiri */}
                <span
                  className="text-brand-700 text-4xl sm:text-5xl font-serif leading-none select-none block -mb-2 sm:-mb-3 group-hover:text-brand-600 transition-colors"
                  aria-hidden="true"
                >
                  "
                </span>

                {/* Isi pesan */}
                <p className="text-parchment-200 leading-relaxed text-sm whitespace-pre-wrap font-mono break-words">
                  {item.message}
                </p>

                {/* Footer: tanggal */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-ink-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-700 shrink-0" aria-hidden="true" />
                  <p className="text-xs text-ink-500 font-mono">
                    {formatDate(item.approvedAt || item.createdAt)}
                  </p>
                </div>
              </article>
            ))}
          </div>

          {pagination && page < pagination.totalPages && (
            <button
              onClick={() => loadMenfes(page + 1)}
              disabled={loading}
              className="btn-secondary w-full text-sm font-mono tracking-wider py-3.5 sm:py-3 touch-manipulation"
            >
              {loading ? 'MEMUAT...' : 'LIHAT LEBIH BANYAK'}
            </button>
          )}
        </>
      )}
    </div>
  );
}
