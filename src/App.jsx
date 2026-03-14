import { useState, useEffect } from 'react';
import { getBooksList, getBookCover } from './github';
import Reader from './Reader';

function App() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBookPath, setSelectedBookPath] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        const data = await getBooksList();
        setBooks(data.map(b => ({ ...b, cover: null, coverLoading: true })));
        setLoading(false);
        // Загружаем обложки по одной асинхронно
        data.forEach(async (book, i) => {
          try {
            const cover = await getBookCover(book.path);
            setBooks(prev => prev.map((b, idx) =>
              idx === i ? { ...b, cover, coverLoading: false } : b
            ));
          } catch {
            setBooks(prev => prev.map((b, idx) =>
              idx === i ? { ...b, coverLoading: false } : b
            ));
          }
        });
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    }
    init();
  }, []);

  if (selectedBookPath) {
    return <Reader bookPath={selectedBookPath} onBack={() => setSelectedBookPath(null)} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: 'var(--sans)',
      padding: '0',
    }}>
      {/* Шапка */}
      <header style={{
        padding: '32px 40px 24px',
        borderBottom: '1px solid var(--border)',
      }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 600, color: 'var(--text-h)', letterSpacing: '-0.5px' }}>
          📚 Моя библиотека
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--text)', opacity: 0.7 }}>
          {books.length > 0 ? `${books.length} книг` : ''}
        </p>
      </header>

      {/* Галерея */}
      <main style={{ padding: '32px 40px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text)', opacity: 0.5 }}>
            Загрузка библиотеки...
          </div>
        )}

        {!loading && books.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text)', opacity: 0.5 }}>
            Книг нет. Добавьте epub файлы в репозиторий.
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: '28px',
        }}>
          {books.map((book) => (
            <BookCard
              key={book.sha}
              book={book}
              onClick={() => setSelectedBookPath(book.path)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function BookCard({ book, onClick }) {
  const [hovered, setHovered] = useState(false);
  const title = book.name.replace('.epub', '');

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 0.2s ease',
      }}
    >
      {/* Обложка */}
      <div style={{
        width: '100%',
        aspectRatio: '2/3',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'var(--code-bg)',
        boxShadow: hovered
          ? '0 12px 30px rgba(0,0,0,0.2)'
          : '0 4px 12px rgba(0,0,0,0.1)',
        transition: 'box-shadow 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {book.coverLoading && (
          <div style={{
            width: '32px', height: '32px',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        )}
        {!book.coverLoading && book.cover && (
          <img
            src={book.cover}
            alt={title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {!book.coverLoading && !book.cover && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            padding: '20px',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: '40px' }}>📖</span>
            <span style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.6, lineHeight: 1.3 }}>{title}</span>
          </div>
        )}
      </div>

      {/* Название */}
      <div style={{
        fontSize: '13px',
        fontWeight: 500,
        color: 'var(--text-h)',
        lineHeight: '1.3',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {title}
      </div>
    </div>
  );
}

export default App;