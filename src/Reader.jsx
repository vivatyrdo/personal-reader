import { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';
import { getBookFile, saveProgress, getAllProgress } from './github';

function Reader({ bookPath, onBack }) {
  const viewerRef = useRef(null);
  const renditionRef = useRef(null);
  const bookRef = useRef(null);
  const touchStartX = useRef(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fontSize, setFontSize] = useState(100);
  const [showToc, setShowToc] = useState(false);
  const [toc, setToc] = useState([]);

  useEffect(() => {
    if (!viewerRef.current) return;
    let destroyed = false;

    async function init() {
      try {
        const data = await getBookFile(bookPath);
        const allProgress = await getAllProgress();
        if (destroyed) return;

        const book = ePub(data);
        bookRef.current = book;

        book.loaded.metadata.then(meta => {
          if (!destroyed) setTitle(meta.title);
        });

        book.loaded.navigation.then(nav => {
          if (!destroyed) setToc(nav.toc || []);
        });

        await book.ready;
        if (destroyed) return;

        const rendition = book.renderTo(viewerRef.current, {
          width: "100%",
          height: "100%",
          flow: "paginated",
          manager: "default",
        });

        renditionRef.current = rendition;

        rendition.hooks.content.register((contents) => {
          contents.addStylesheetRules({
            "body": { "padding": "0 20px !important" },
            "img": { "max-width": "100% !important", "height": "auto !important" }
          });
        });

        rendition.themes.fontSize(`${fontSize}%`);

        const savedCfi = allProgress[bookPath]?.cfi;
        await rendition.display(savedCfi || undefined);

        if (destroyed) return;

        rendition.on("relocated", (location) => {
          if (destroyed) return;
          const pct = book.locations.percentageFromCfi(location.start.cfi);
          if (pct !== undefined) setProgress(Math.round(pct * 100));
        });

        // Генерируем локации для прогресс бара
        book.locations.generate(1000);

        setIsReady(true);
        setLoading(false);

      } catch (e) {
        console.error("Ошибка инициализации:", e);
        if (!destroyed) setLoading(false);
      }
    }

    init();

    return () => {
      destroyed = true;
      if (bookRef.current) {
        bookRef.current.destroy();
        bookRef.current = null;
      }
      renditionRef.current = null;
      setIsReady(false);
      setLoading(true);
    };
  }, [bookPath]);

  // Применяем размер шрифта при изменении
  useEffect(() => {
    if (renditionRef.current && isReady) {
      renditionRef.current.themes.fontSize(`${fontSize}%`);
    }
  }, [fontSize, isReady]);

  const handleNext = async () => {
    if (renditionRef.current && isReady) await renditionRef.current.next();
  };

  const handlePrev = async () => {
    if (renditionRef.current && isReady) await renditionRef.current.prev();
  };

  const handleBack = async () => {
    const location = renditionRef.current?.location;
    if (location) {
      const cfi = location.start.cfi;
      try { await saveProgress(bookPath, cfi); } catch (e) { console.error(e); }
    }
    onBack();
  };

  const handleTocClick = async (href) => {
    if (renditionRef.current && isReady) {
      await renditionRef.current.display(href);
      setShowToc(false);
    }
  };

  // Свайп на телефоне
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0,
      width: '100vw', height: '100vh',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      color: 'var(--text)',
    }}>

      {/* ШАПКА */}
      <div style={{
        height: '56px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '12px',
        flexShrink: 0,
      }}>
        {/* Кнопка назад */}
        <button onClick={handleBack} style={btnStyle}>
          ← Библиотека
        </button>

        {/* Название */}
        <div style={{
          flex: 1,
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: 500,
          color: 'var(--text-h)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          padding: '0 8px',
        }}>
          {title || '...'}
        </div>

        {/* Размер шрифта */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button onClick={() => setFontSize(f => Math.max(70, f - 10))} style={iconBtnStyle}>A−</button>
          <button onClick={() => setFontSize(f => Math.min(150, f + 10))} style={iconBtnStyle}>A+</button>
        </div>

        {/* Оглавление */}
        {toc.length > 0 && (
          <button onClick={() => setShowToc(v => !v)} style={iconBtnStyle}>
            ☰
          </button>
        )}
      </div>

      {/* ПРОГРЕСС БАР */}
      <div style={{ height: '3px', background: 'var(--border)', flexShrink: 0 }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'var(--accent)',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* ОБЛАСТЬ ЧТЕНИЯ */}
      <div
        style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />

        {/* Зоны клика для навигации */}
        {isReady && (
          <>
            <div onClick={handlePrev} style={{
              position: 'absolute', left: 0, top: 0,
              width: '20%', height: '100%',
              cursor: 'w-resize', zIndex: 5,
            }} />
            <div onClick={handleNext} style={{
              position: 'absolute', right: 0, top: 0,
              width: '20%', height: '100%',
              cursor: 'e-resize', zIndex: 5,
            }} />
          </>
        )}

        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'var(--bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10, fontSize: '14px', color: 'var(--text)', opacity: 0.7,
          }}>
            Загрузка книги...
          </div>
        )}
      </div>

      {/* НИЖНЯЯ ПАНЕЛЬ */}
      <div style={{
        height: '56px',
        background: 'var(--bg)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}>
        <button onClick={handlePrev} disabled={!isReady} style={navBtnStyle(isReady)}>
          ← Назад
        </button>
        <span style={{ fontSize: '13px', opacity: 0.5 }}>{progress}%</span>
        <button onClick={handleNext} disabled={!isReady} style={navBtnStyle(isReady)}>
          Вперёд →
        </button>
      </div>

      {/* ОГЛАВЛЕНИЕ (drawer) */}
      {showToc && (
        <>
          <div
            onClick={() => setShowToc(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.4)',
              zIndex: 20,
            }}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0,
            width: 'min(320px, 85vw)',
            height: '100vh',
            background: 'var(--bg)',
            borderLeft: '1px solid var(--border)',
            zIndex: 21,
            overflowY: 'auto',
            padding: '20px 0',
          }}>
            <div style={{ padding: '0 20px 16px', fontSize: '16px', fontWeight: 600, color: 'var(--text-h)', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
              Оглавление
            </div>
            {toc.map((item, i) => (
              <TocItem key={i} item={item} onClick={handleTocClick} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TocItem({ item, onClick, depth = 0 }) {
  return (
    <>
      <div
        onClick={() => onClick(item.href)}
        style={{
          padding: `10px 20px 10px ${20 + depth * 16}px`,
          cursor: 'pointer',
          fontSize: '14px',
          color: 'var(--text-h)',
          borderBottom: '1px solid var(--border)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {item.label}
      </div>
      {item.subitems?.map((sub, i) => (
        <TocItem key={i} item={sub} onClick={onClick} depth={depth + 1} />
      ))}
    </>
  );
}

// Стили
const btnStyle = {
  background: 'var(--code-bg)',
  color: 'var(--text-h)',
  border: '1px solid var(--border)',
  padding: '6px 12px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const iconBtnStyle = {
  background: 'var(--code-bg)',
  color: 'var(--text-h)',
  border: '1px solid var(--border)',
  padding: '6px 10px',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '13px',
  flexShrink: 0,
};

const navBtnStyle = (isReady) => ({
  background: isReady ? 'var(--accent)' : 'var(--border)',
  color: '#fff',
  border: 'none',
  padding: '8px 24px',
  borderRadius: '8px',
  cursor: isReady ? 'pointer' : 'not-allowed',
  fontSize: '14px',
  fontWeight: 500,
  transition: 'background 0.2s',
});

export default Reader;