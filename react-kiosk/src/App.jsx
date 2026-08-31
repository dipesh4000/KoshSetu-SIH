import { useState, useEffect, useRef, useMemo } from 'react';
import { records, timelineEvents, decades, mediaItems, transcript, hindiTranslation, suggestions, uiCopy } from './data';
import './styles.css';

const PAGES = ['home', 'archive', 'timeline', 'media', 'ask'];

function Icon({ name, filled = false, size = 28, className = '' }) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? 'icon-filled' : ''} ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}

function NavRail({ page, onNavigate }) {
  const items = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'timeline', icon: 'timeline', label: 'Timeline' },
    { id: 'archive', icon: 'inventory_2', label: 'Archive' },
    { id: 'media', icon: 'perm_media', label: 'Media' },
    { id: 'ask', icon: 'contact_support', label: 'Ask' },
  ];
  return (
    <nav className="hidden md:flex bg-surface-container border-r-2 border-tertiary/20 flex-col items-center justify-center w-rail-width h-full flex-shrink-0 z-40 space-y-2">
      {items.map(item => {
        const active = page === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center py-5 w-full transition-all active:scale-95 ${
              active
                ? 'bg-tertiary-container text-on-tertiary-container border-r-4 border-tertiary font-bold'
                : 'text-secondary hover:bg-secondary-fixed-dim'
            }`}
          >
            <Icon name={item.icon} filled={active} size={30} />
            <span className="font-label-md text-label-md mt-1">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function BottomNav({ page, onNavigate }) {
  const items = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'timeline', icon: 'timeline', label: 'Timeline' },
    { id: 'archive', icon: 'inventory_2', label: 'Archive' },
    { id: 'media', icon: 'perm_media', label: 'Media' },
    { id: 'ask', icon: 'contact_support', label: 'Ask' },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-[72px] bg-surface-container border-t-2 border-tertiary/20 flex items-stretch">
      {items.map(item => {
        const active = page === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
              active ? 'text-tertiary' : 'text-secondary'
            }`}
          >
            <Icon name={item.icon} filled={active} size={22} />
            <span className="font-label-md text-[11px] leading-none">{item.label}</span>
            {active && <div className="absolute top-0 w-12 h-[3px] bg-tertiary rounded-b-full" />}
          </button>
        );
      })}
    </nav>
  );
}

function TopBar({ language, onLanguage }) {
  return (
    <header className="bg-surface border-b-2 border-tertiary/20 flex justify-between items-center w-full px-8 md:px-margin-kiosk h-touch-lg flex-shrink-0 z-50">
      <div className="flex items-center gap-3">
        <Icon name="language" size={28} className="text-primary" />
        <span className="font-headline-md text-[20px] md:text-headline-md font-bold text-primary uppercase tracking-widest">
          Digital Heritage Archive
        </span>
      </div>
      <div className="flex items-center gap-2">
        {['ENG', 'हिंदी'].map(lang => (
          <button
            key={lang}
            onClick={() => onLanguage(lang)}
            className={`h-10 px-4 rounded-full font-label-md text-label-md transition-colors ${
              language === lang
                ? 'bg-tertiary text-on-tertiary'
                : 'border border-outline-variant text-secondary hover:bg-surface-container'
            }`}
          >
            {lang}
          </button>
        ))}
      </div>
    </header>
  );
}

// ─── HOME ────────────────────────────────────────────────────────────────────

function RecordCard({ record, onClick }) {
  return (
    <button
      onClick={() => onClick(record)}
      className="bg-parchment-bright border border-outline-variant/50 rounded-xl overflow-hidden flex flex-col text-left hover:shadow-md active:scale-[0.97] transition-all duration-200 group"
    >
      {/* Image */}
      <div className="relative w-full h-44 bg-surface-container-high overflow-hidden flex-shrink-0">
        <img
          src={record.imageUrl}
          alt={record.title}
          className="w-full h-full object-cover grayscale-[20%] group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        {/* Badges */}
        <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
          {record.verified && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-verified-green/20 border border-verified-green/40 text-verified-green text-[12px] font-semibold backdrop-blur-sm">
              <Icon name="verified" size={13} filled /> Verified
            </span>
          )}
          {record.aiAssisted && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-ai-assisted-blue/20 border border-ai-assisted-blue/40 text-ai-assisted-blue text-[12px] font-semibold backdrop-blur-sm">
              <Icon name="auto_awesome" size={13} /> AI Assisted
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-5 gap-2">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md text-secondary uppercase tracking-wider">{record.type}</span>
          <span className="font-label-md text-label-md text-tertiary font-bold">{record.year}</span>
        </div>
        <h3 className="font-headline-md text-[22px] leading-tight text-primary font-semibold line-clamp-2">{record.title}</h3>
        <p className="font-body-md text-[15px] text-on-surface-variant leading-relaxed line-clamp-2 flex-1">{record.description}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {record.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[11px] font-medium rounded uppercase tracking-wide">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 flex items-center justify-between border-t border-outline-variant/30 pt-3">
        <span className="font-label-md text-label-md text-secondary">{record.id}</span>
        <span className="flex items-center gap-1 text-tertiary font-label-md text-label-md font-semibold">
          Open <Icon name="arrow_forward" size={16} />
        </span>
      </div>
    </button>
  );
}

function Home({ copy, onNavigate, onOpenRecord }) {
  return (
    <div className="flex-1 overflow-y-auto pb-20 md:pb-0 page-enter">
      {/* Hero */}
      <div className="relative bg-primary-container overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #cea72c 0%, transparent 60%)' }} />
        <div className="relative px-8 md:px-margin-kiosk py-12 md:py-16 max-w-4xl">
          <p className="font-label-lg text-label-lg text-tertiary-fixed-dim uppercase tracking-widest mb-3">
            Ambedkar Digital Heritage
          </p>
          <h1 className="font-display-lg text-[clamp(36px,5vw,64px)] leading-tight text-parchment-bright font-bold mb-4">
            The archive is not a room.<br />
            <em className="text-tertiary-fixed not-italic">It is a conversation.</em>
          </h1>
          <p className="font-body-lg text-[18px] text-on-primary-container leading-relaxed max-w-2xl mb-8">
            Explore the speeches, writings and constitutional work of Dr. B. R. Ambedkar through verified records, multilingual reading and source-grounded stories.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => onNavigate('archive')}
              className="flex items-center gap-2 h-14 px-8 bg-tertiary text-on-tertiary font-label-lg text-label-lg rounded hover:bg-tertiary-container hover:text-on-tertiary-container transition-colors"
            >
              {copy.archive} <Icon name="arrow_forward" size={18} />
            </button>
            <button
              onClick={() => onOpenRecord(records[0])}
              className="flex items-center gap-2 h-14 px-8 border-2 border-tertiary-fixed-dim text-tertiary-fixed-dim font-label-lg text-label-lg rounded hover:bg-white/10 transition-colors"
            >
              <Icon name="description" size={18} /> Read 1936 document
            </button>
          </div>
        </div>
      </div>

      {/* Entry strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-outline-variant/30">
        {[
          { num: '01', label: 'Read the record', sub: 'Writings, speeches and debates', page: 'archive', icon: 'inventory_2' },
          { num: '02', label: 'Follow the life', sub: 'Key historical milestones', page: 'timeline', icon: 'timeline' },
          { num: '03', label: 'Ask with evidence', sub: 'Answers grounded in cited sources', page: 'ask', icon: 'contact_support' },
        ].map(item => (
          <button
            key={item.num}
            onClick={() => onNavigate(item.page)}
            className="flex items-center gap-5 px-8 py-6 border-b md:border-b-0 md:border-r border-outline-variant/30 bg-surface hover:bg-surface-container-low text-left transition-colors active:scale-[0.98] group"
          >
            <span className="text-tertiary font-display-lg text-[28px] font-bold flex-shrink-0">{item.num}</span>
            <div className="flex-1 min-w-0">
              <strong className="block font-headline-md text-[18px] text-primary">{item.label}</strong>
              <small className="block text-secondary font-label-md text-label-md mt-0.5">{item.sub}</small>
            </div>
            <Icon name="chevron_right" size={22} className="text-tertiary group-hover:translate-x-1 transition-transform" />
          </button>
        ))}
      </div>

      {/* Archive record cards grid */}
      <div className="px-8 md:px-margin-kiosk py-10">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <p className="font-label-lg text-label-lg text-tertiary uppercase tracking-widest mb-1">Browse the collection</p>
            <h2 className="font-headline-lg text-[clamp(28px,3vw,40px)] text-primary font-semibold">Archive Records</h2>
          </div>
          <button
            onClick={() => onNavigate('archive')}
            className="flex items-center gap-1 text-tertiary font-label-lg text-label-lg hover:underline"
          >
            View all <Icon name="arrow_forward" size={16} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {records.map(record => (
            <RecordCard key={record.id} record={record} onClick={onOpenRecord} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState('home');
  const [language, setLanguage] = useState('ENG');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState(null);
  const copy = uiCopy[language];

  const navigate = (next) => {
    setSelectedRecord(null);
    setSelectedTimelineEvent(null);
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openRecord = (record) => {
    setSelectedRecord(record);
  };

  const currentPage = selectedRecord ? 'reader' : page;

  return (
    <div className="flex flex-col h-screen bg-surface text-on-surface overflow-hidden">
      <TopBar language={language} onLanguage={setLanguage} />
      <div className="flex flex-1 overflow-hidden">
        {!selectedRecord && <NavRail page={page} onNavigate={navigate} />}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {currentPage === 'reader' && (
            <DocumentViewer
              record={selectedRecord}
              language={language}
              onBack={() => setSelectedRecord(null)}
              onOpenRecord={openRecord}
            />
          )}
          {currentPage === 'home' && (
            <Home copy={copy} onNavigate={navigate} onOpenRecord={openRecord} />
          )}
          {currentPage === 'archive' && (
            <Archive copy={copy} onOpenRecord={openRecord} />
          )}
          {currentPage === 'timeline' && (
            <Timeline
              selectedEvent={selectedTimelineEvent}
              onSelectEvent={setSelectedTimelineEvent}
              onOpenRecord={openRecord}
            />
          )}
          {currentPage === 'media' && <Media />}
          {currentPage === 'ask' && <Ask onOpenRecord={openRecord} />}
        </main>
      </div>
      {!selectedRecord && <BottomNav page={page} onNavigate={navigate} />}
    </div>
  );
}

// ─── ARCHIVE ─────────────────────────────────────────────────────────────────

function Archive({ copy, onOpenRecord }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const types = ['All', ...new Set(records.map(r => r.type))];
  const visible = useMemo(() =>
    records.filter(r =>
      (filter === 'All' || r.type === filter) &&
      `${r.title} ${r.description} ${r.tags.join(' ')} ${r.year}`.toLowerCase().includes(query.toLowerCase())
    ), [query, filter]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden page-enter">
      {/* Header */}
      <div className="px-8 md:px-margin-kiosk pt-8 pb-4 border-b border-outline-variant/30 flex flex-col md:flex-row md:items-end gap-4 flex-shrink-0">
        <div className="flex-1">
          <p className="font-label-lg text-label-lg text-tertiary uppercase tracking-widest mb-1">Collection</p>
          <h1 className="font-headline-lg text-[clamp(28px,3vw,48px)] text-primary font-semibold">Archive &amp; Records</h1>
          <p className="text-secondary font-body-md text-[16px] mt-1">{visible.length} records</p>
        </div>
        {/* Search */}
        <label className="flex items-center gap-3 h-14 px-4 bg-surface-container border border-outline-variant/50 rounded-lg w-full md:w-80">
          <Icon name="search" size={20} className="text-tertiary flex-shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={copy.search}
            className="flex-1 bg-transparent border-0 outline-none text-primary font-body-md text-[16px] placeholder:text-outline"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-secondary hover:text-primary">
              <Icon name="close" size={18} />
            </button>
          )}
        </label>
      </div>

      {/* Filter chips */}
      <div className="flex gap-3 px-8 md:px-margin-kiosk py-4 overflow-x-auto hide-scrollbar flex-shrink-0 border-b border-outline-variant/20">
        {types.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`flex-shrink-0 h-10 px-5 rounded-full font-label-md text-label-md transition-all ${
              filter === type
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container text-secondary border border-outline-variant/50 hover:bg-surface-container-high'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-8 md:px-margin-kiosk py-8 pb-24 md:pb-8">
        {visible.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visible.map(record => (
              <RecordCard key={record.id} record={record} onClick={onOpenRecord} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Icon name="search_off" size={48} className="text-tertiary mb-4" />
            <h2 className="font-headline-md text-headline-md text-primary mb-2">No records found</h2>
            <p className="text-secondary font-body-md text-body-md mb-6">Try "equality", "constitution" or "1936"</p>
            <button
              onClick={() => { setQuery(''); setFilter('All'); }}
              className="h-12 px-6 border border-outline-variant rounded-lg text-primary font-label-lg text-label-lg hover:bg-surface-container"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TIMELINE ────────────────────────────────────────────────────────────────

function Timeline({ selectedEvent, onSelectEvent, onOpenRecord }) {
  const [activeDec, setActiveDec] = useState('Pre-1900');
  const active = selectedEvent || timelineEvents[0];

  const filtered = useMemo(() =>
    timelineEvents.filter(e => e.decade === activeDec),
    [activeDec]
  );

  const relatedRecord = records.find(r => r.id === active.relatedRecord);

  return (
    <div className="flex-1 flex flex-col overflow-hidden page-enter">
      {/* Header */}
      <div className="px-8 md:px-margin-kiosk pt-8 pb-4 flex-shrink-0 border-b border-outline-variant/30">
        <p className="font-label-lg text-label-lg text-tertiary uppercase tracking-widest mb-1">Historical Chronology</p>
        <h1 className="font-headline-lg text-[clamp(28px,3vw,48px)] text-primary font-semibold">Timeline</h1>
        <p className="text-secondary font-body-md text-[16px] mt-1">Select an event to see its context and linked archive records.</p>
      </div>

      {/* Decade selector */}
      <div className="flex gap-3 px-8 md:px-margin-kiosk py-4 overflow-x-auto hide-scrollbar flex-shrink-0 border-b border-outline-variant/20">
        {decades.map(dec => (
          <button
            key={dec}
            onClick={() => { setActiveDec(dec); onSelectEvent(null); }}
            className={`flex-shrink-0 h-12 px-6 rounded-full font-label-lg text-label-lg transition-all ${
              activeDec === dec
                ? 'bg-primary text-on-primary shadow-md'
                : 'bg-surface-container text-on-surface border border-outline-variant/50 hover:bg-surface-container-high'
            }`}
          >
            {dec}
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: event list */}
        <div className="w-full md:w-5/12 overflow-y-auto hide-scrollbar border-r border-outline-variant/30 relative">
          {/* Vertical line */}
          <div className="absolute left-[calc(2rem+18px)] top-0 bottom-0 w-px bg-outline-variant/40 hidden md:block" />
          <div className="flex flex-col py-6 gap-2">
            {filtered.length === 0 && (
              <p className="px-8 text-secondary font-body-md text-body-md py-8">No events in this period.</p>
            )}
            {filtered.map(event => {
              const isActive = active.id === event.id;
              return (
                <div key={event.id} className="relative pl-8 md:pl-16 pr-6">
                  {/* Dot */}
                  <div className={`absolute left-7 md:left-[2.6rem] top-7 w-4 h-4 rounded-full border-2 border-surface z-10 transition-all ${
                    isActive ? 'bg-tertiary scale-125' : 'bg-outline'
                  }`} />
                  <button
                    onClick={() => onSelectEvent(event)}
                    className={`w-full text-left rounded-xl p-5 transition-all active:scale-[0.98] ${
                      isActive
                        ? 'bg-surface-bright border-2 border-tertiary shadow-sm relative overflow-hidden'
                        : 'hover:bg-surface-container border border-transparent hover:border-outline-variant/30'
                    }`}
                  >
                    {isActive && <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-tertiary" />}
                    <p className={`font-label-md text-label-md mb-1 ${isActive ? 'text-tertiary font-bold' : 'text-secondary'}`}>
                      {event.date}
                    </p>
                    <h3 className={`font-body-lg text-[18px] font-semibold ${isActive ? 'text-primary' : 'text-primary'}`}>
                      {event.title}
                    </h3>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="hidden md:flex w-7/12 overflow-y-auto hide-scrollbar p-gutter">
          <div className="bg-parchment-bright border border-outline-variant/40 rounded-2xl p-10 w-full flex flex-col shadow-sm">
            <p className="font-label-lg text-label-lg text-tertiary font-bold tracking-widest mb-3">{active.date}</p>
            <h2 className="font-headline-lg text-headline-lg text-primary mb-5 leading-tight">{active.title}</h2>
            <p className="font-body-lg text-body-lg text-secondary leading-relaxed mb-8">{active.body}</p>
            <hr className="border-outline-variant/30 mb-8" />
            {relatedRecord && (
              <div>
                <h3 className="font-headline-md text-headline-md text-primary mb-4">Related material</h3>
                <button
                  onClick={() => onOpenRecord(relatedRecord)}
                  className="w-full bg-surface border border-outline-variant/40 rounded-xl p-4 flex gap-5 items-center hover:shadow-sm active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-20 h-28 bg-surface-container-highest border border-outline-variant/20 rounded-lg flex-shrink-0 overflow-hidden">
                    <img src={relatedRecord.imageUrl} alt={relatedRecord.title} className="w-full h-full object-cover grayscale-[30%]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-label-md text-label-md text-secondary uppercase">{relatedRecord.type}</span>
                      <span className="text-outline">·</span>
                      <span className="font-label-md text-label-md text-tertiary font-bold">{relatedRecord.year}</span>
                    </div>
                    <h4 className="font-body-md text-body-md text-primary font-semibold leading-snug mb-1">{relatedRecord.title}</h4>
                    <p className="font-label-md text-label-md text-secondary">{relatedRecord.id}</p>
                  </div>
                  <Icon name="arrow_forward" size={20} className="text-tertiary flex-shrink-0" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile detail drawer */}
      {active && (
        <div className="md:hidden border-t-2 border-tertiary/20 bg-parchment-bright p-6 pb-24 overflow-y-auto max-h-[45vh]">
          <p className="font-label-md text-label-md text-tertiary font-bold mb-2">{active.date}</p>
          <h2 className="font-headline-md text-headline-md text-primary mb-3">{active.title}</h2>
          <p className="font-body-md text-body-md text-secondary leading-relaxed">{active.body}</p>
          {relatedRecord && (
            <button
              onClick={() => onOpenRecord(relatedRecord)}
              className="mt-4 flex items-center gap-2 text-tertiary font-label-lg text-label-lg"
            >
              Open: {relatedRecord.title} <Icon name="arrow_forward" size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MEDIA ───────────────────────────────────────────────────────────────────

function Media() {
  const [activeMedia, setActiveMedia] = useState(mediaItems[0]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(33);
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    if (playing) {
      timerRef.current = window.setInterval(() =>
        setProgress(p => p >= 100 ? (setPlaying(false), 0) : p + 0.3), 150);
    }
    return () => window.clearInterval(timerRef.current);
  }, [playing]);

  const selectMedia = (item) => {
    setActiveMedia(item);
    setPlaying(false);
    setProgress(0);
  };

  const elapsed = Math.floor((progress / 100) * parseInt(activeMedia.duration.split(':')[0]) * 60 + parseInt(activeMedia.duration.split(':')[1]));
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden page-enter">
      {/* Header */}
      <div className="px-8 md:px-margin-kiosk pt-8 pb-4 border-b border-outline-variant/30 flex items-end justify-between flex-shrink-0">
        <div>
          <p className="font-label-lg text-label-lg text-tertiary uppercase tracking-widest mb-1">Audio &amp; Visual</p>
          <h1 className="font-headline-lg text-[clamp(28px,3vw,48px)] text-primary font-semibold">Media Archive</h1>
        </div>
        <span className="px-3 py-1 border border-tertiary text-tertiary font-label-md text-label-md rounded uppercase tracking-wider">
          Simulated Media
        </span>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: player */}
        <div className="flex-1 flex flex-col overflow-y-auto hide-scrollbar p-6 md:p-margin-kiosk gap-6">
          {/* Visual */}
          <div className="relative w-full aspect-video bg-surface-container-high rounded-xl overflow-hidden border border-stone shadow-sm">
            <img
              src={activeMedia.imageUrl}
              alt={activeMedia.title}
              className="w-full h-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <span className="text-parchment-bright font-label-md text-[11px] uppercase tracking-widest opacity-80">
                {activeMedia.type} · {activeMedia.date}
              </span>
            </div>
          </div>

          {/* Controls card */}
          <div className="bg-parchment-bright border border-stone rounded-xl p-6 md:p-8 flex flex-col gap-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-surface-container font-label-md text-label-md text-on-surface-variant rounded-sm uppercase text-[11px]">
                    {activeMedia.type}
                  </span>
                  {activeMedia.verified && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-verified-green/10 text-verified-green border border-verified-green/20 font-label-md text-[11px] rounded-sm">
                      <Icon name="verified" size={12} filled /> Authenticated
                    </span>
                  )}
                  {activeMedia.aiSynced && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-ai-assisted-blue/10 text-ai-assisted-blue border border-ai-assisted-blue/20 font-label-md text-[11px] rounded-sm">
                      <Icon name="auto_awesome" size={12} /> Auto-synced
                    </span>
                  )}
                </div>
                <h2 className="font-headline-md text-headline-md text-ink leading-tight">{activeMedia.title}</h2>
                <p className="font-body-md text-[16px] text-on-surface-variant mt-1">{activeMedia.date} · {activeMedia.location}</p>
              </div>
            </div>

            {/* Progress */}
            <div
              className="w-full cursor-pointer group"
              onClick={e => setProgress((e.nativeEvent.offsetX / e.currentTarget.offsetWidth) * 100)}
            >
              <div className="h-2 bg-surface-variant rounded-full relative overflow-hidden">
                <div className="absolute left-0 top-0 h-full bg-brass-patina rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 font-label-md text-label-md text-on-surface-variant">
                <span>{fmt(elapsed)}</span>
                <span>{activeMedia.duration}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <button className="w-14 h-14 rounded-full border border-stone flex items-center justify-center text-ink hover:bg-surface-container-low transition-colors">
                  <Icon name="volume_up" size={24} />
                </button>
                <button className="w-14 h-14 rounded-full border border-stone flex items-center justify-center text-ink hover:bg-surface-container-low transition-colors">
                  <Icon name="closed_caption" size={24} />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setProgress(p => Math.max(0, p - 5))} className="w-14 h-14 flex items-center justify-center text-ink hover:opacity-70">
                  <Icon name="replay_10" size={32} />
                </button>
                <button
                  onClick={() => setPlaying(v => !v)}
                  className="w-20 h-20 rounded-full bg-ink text-parchment-bright flex items-center justify-center shadow-lg hover:opacity-90 active:scale-95 transition-all"
                >
                  <Icon name={playing ? 'pause' : 'play_arrow'} size={40} filled />
                </button>
                <button onClick={() => setProgress(p => Math.min(100, p + 5))} className="w-14 h-14 flex items-center justify-center text-ink hover:opacity-70">
                  <Icon name="forward_10" size={32} />
                </button>
              </div>
              <div className="w-[116px]" />
            </div>
          </div>

          {/* Media selector */}
          <div className="flex flex-col gap-3">
            <h3 className="font-headline-md text-[20px] text-primary font-semibold">More recordings</h3>
            {mediaItems.map(item => (
              <button
                key={item.id}
                onClick={() => selectMedia(item)}
                className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all active:scale-[0.98] ${
                  activeMedia.id === item.id
                    ? 'border-tertiary bg-tertiary/5'
                    : 'border-outline-variant/40 bg-parchment-bright hover:bg-surface-container-low'
                }`}
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-label-md text-label-md text-secondary uppercase mb-0.5">{item.type}</p>
                  <h4 className="font-body-md text-[16px] text-primary font-semibold line-clamp-1">{item.title}</h4>
                  <p className="font-label-md text-label-md text-secondary">{item.date} · {item.duration}</p>
                </div>
                {activeMedia.id === item.id && <Icon name="equalizer" size={20} className="text-tertiary flex-shrink-0" filled />}
              </button>
            ))}
          </div>
        </div>

        {/* Right: transcript */}
        <div className="hidden lg:flex w-[380px] flex-col border-l border-stone flex-shrink-0">
          <div className="p-6 border-b-2 border-stone flex justify-between items-center bg-surface-container-low flex-shrink-0">
            <h3 className="font-headline-md text-headline-md text-ink">Transcript</h3>
            <button
              onClick={() => setTranscriptOpen(v => !v)}
              className="text-secondary hover:text-primary transition-colors"
            >
              <Icon name={transcriptOpen ? 'expand_less' : 'expand_more'} size={24} />
            </button>
          </div>
          {transcriptOpen && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 hide-scrollbar">
              <blockquote className="border-l-4 border-tertiary pl-4 font-body-lg text-[18px] text-ink italic leading-relaxed">
                {activeMedia.quote}
              </blockquote>
              <hr className="border-outline-variant/30" />
              {activeMedia.transcript.map((line, i) => (
                <p
                  key={i}
                  className={`font-body-lg text-[17px] leading-relaxed pl-4 py-3 rounded-r-lg border-l-4 transition-all cursor-pointer ${
                    line.active
                      ? 'border-brass-patina bg-brass-patina/5 text-ink font-semibold shadow-sm'
                      : 'border-transparent text-on-surface-variant opacity-60 hover:opacity-100 hover:border-stone'
                  }`}
                >
                  {line.text}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ASK ─────────────────────────────────────────────────────────────────────

function Ask({ onOpenRecord }) {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [answered, setAnswered] = useState(false);

  const submit = (q = question) => {
    if (!q.trim()) return;
    setQuestion(q);
    setAsked(true);
    setAnswered(false);
    setLoading(true);
    window.setTimeout(() => { setLoading(false); setAnswered(true); }, 900);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden page-enter">
      {/* Idle bar */}
      <div className="h-1 bg-surface-container-high flex-shrink-0">
        <div className="h-full bg-tertiary idle-bar" />
      </div>

      {/* Header */}
      <div className="px-8 md:px-margin-kiosk pt-8 pb-4 border-b border-outline-variant/30 flex-shrink-0">
        <p className="font-label-lg text-label-lg text-tertiary uppercase tracking-widest mb-1">Research Assistant</p>
        <h1 className="font-headline-lg text-[clamp(28px,3vw,48px)] text-primary font-semibold">Ask the Archive</h1>
        <p className="text-secondary font-body-md text-[16px] mt-1">
          Answers grounded in cited archival sources. This demo returns a prepared response.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 md:px-margin-kiosk py-8 pb-24 md:pb-8 flex flex-col gap-6 max-w-4xl w-full mx-auto">
        {/* Answer area */}
        {!asked && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-28 h-28 border-2 border-tertiary rotate-45 flex items-center justify-center mb-6">
              <Icon name="auto_awesome" size={44} className="text-tertiary -rotate-45" />
            </div>
            <h2 className="font-headline-lg text-[clamp(28px,3vw,42px)] text-primary font-semibold mb-3">
              Ask the archive.<br />Follow the evidence.
            </h2>
            <p className="text-secondary font-body-md text-body-md max-w-xl">
              Type a question below or choose a suggestion to see a source-linked demonstration answer.
            </p>
          </div>
        )}

        {asked && (
          <div className="flex justify-end">
            <div className="bg-surface-container-high text-on-surface px-6 py-5 rounded-2xl rounded-br-none max-w-2xl border border-outline-variant/20 shadow-sm">
              <p className="font-body-lg text-body-lg">{question}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 px-6 py-5">
            <div className="flex gap-1.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-2.5 h-2.5 bg-tertiary rounded-full dot-blink" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p className="text-secondary font-body-md text-body-md">Reading across the archive…</p>
          </div>
        )}

        {answered && (
          <div className="bg-parchment-bright border border-outline-variant/40 rounded-2xl rounded-bl-none p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <span className="flex items-center gap-2 text-ai-assisted-blue font-label-md text-label-md uppercase tracking-wider">
                <Icon name="auto_awesome" size={16} /> Demonstration Answer
              </span>
              <span className="flex items-center gap-2 text-verified-green font-label-md text-label-md">
                <Icon name="verified" size={16} filled /> 3 sources connected
              </span>
            </div>
            <h2 className="font-headline-md text-headline-md text-primary mb-4 leading-tight">
              Caste is presented as a graded social hierarchy — not simply a division of work.
            </h2>
            <p className="font-body-lg text-[18px] text-on-surface-variant leading-relaxed mb-4">
              In <em>Annihilation of Caste</em>, Ambedkar argues that caste divides workers themselves into ranked groups. The system persists through enforced separation, especially endogamy, and therefore cannot be addressed only through small reforms.
            </p>
            <p className="font-body-lg text-[18px] text-on-surface-variant leading-relaxed mb-6">
              His argument connects social equality with democratic life: political rights remain fragile when everyday society denies liberty, equality and fraternity. The archive links this idea across his 1916 paper, the 1936 address, and his 1949 Constituent Assembly speech.
            </p>

            {/* Citation cards */}
            <div className="flex flex-col gap-3">
              {[records[0], records[5], records[3]].map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => onOpenRecord(r)}
                  className="flex items-center gap-4 p-4 border border-tertiary/30 bg-tertiary/5 rounded-xl text-left hover:bg-tertiary/10 active:scale-[0.98] transition-all"
                >
                  <span className="w-8 h-8 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center font-label-lg text-label-lg flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <strong className="block font-label-lg text-label-lg text-primary">{r.title}</strong>
                    <small className="text-secondary font-label-md text-label-md">{r.id} · {r.year}</small>
                  </div>
                  <Icon name="arrow_forward" size={18} className="text-tertiary flex-shrink-0" />
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-start gap-3 p-4 bg-ai-assisted-blue/5 border border-ai-assisted-blue/20 rounded-xl">
              <Icon name="auto_awesome" size={18} className="text-ai-assisted-blue flex-shrink-0 mt-0.5" />
              <p className="font-label-md text-label-md text-ai-assisted-blue leading-relaxed">
                This is a hardcoded showcase response. In production, generated answers should only use indexed archival sources and expose citations beside every claim.
              </p>
            </div>
          </div>
        )}

        {/* Suggestions */}
        <div className="flex flex-wrap gap-3">
          {suggestions.map(q => (
            <button
              key={q}
              onClick={() => submit(q)}
              className="flex-shrink-0 max-w-sm px-4 py-3 border border-outline-variant/50 bg-surface-container text-secondary font-label-md text-label-md rounded-xl hover:border-tertiary hover:text-primary transition-all text-left"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <form
          onSubmit={e => { e.preventDefault(); submit(); }}
          className="flex items-center gap-3 border-2 border-outline-variant/40 bg-parchment-bright rounded-2xl p-2 focus-within:border-tertiary transition-colors shadow-sm"
        >
          <Icon name="search" size={24} className="text-secondary ml-3 flex-shrink-0" />
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Inquire with the Archive…"
            className="flex-1 bg-transparent border-0 outline-none font-body-md text-[18px] text-primary placeholder:text-outline py-3 px-2"
          />
          <button
            type="submit"
            disabled={!question.trim() || loading}
            className="flex items-center gap-2 h-14 px-6 bg-primary text-on-primary font-label-lg text-label-lg rounded-xl hover:bg-ink-pressed transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            Ask <Icon name="send" size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── DOCUMENT VIEWER ─────────────────────────────────────────────────────────

function DocumentViewer({ record, language, onBack, onOpenRecord }) {
  const [tab, setTab] = useState('transcript');
  const [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const isFeature = record.id === 'A-001';
  const text = tab === 'translation' ? hindiTranslation : transcript;

  useEffect(() => {
    setTab('transcript');
    setZoom(1);
    setPlaying(false);
    setProgress(0);
  }, [record]);

  useEffect(() => {
    if (playing) {
      timerRef.current = window.setInterval(() =>
        setProgress(p => p >= 100 ? (setPlaying(false), 0) : p + 0.6), 140);
    }
    return () => window.clearInterval(timerRef.current);
  }, [playing]);

  const fmt = s => { const sec = Math.floor(s); return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`; };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden page-enter h-full">
      {/* Left: document pane */}
      <div className="w-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-stone bg-surface-container-low h-[45vh] md:h-full flex-shrink-0">
        {/* Toolbar */}
        <div className="h-touch-lg flex items-center justify-between px-6 border-b border-stone bg-parchment-bright/90 backdrop-blur flex-shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-on-surface-variant font-label-lg text-label-lg hover:text-ink transition-colors min-h-[56px]"
          >
            <Icon name="arrow_back" size={22} /> Back to Archive
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom(z => Math.max(0.7, z - 0.1))}
              className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-stone transition-colors"
            >
              <Icon name="zoom_out" size={22} />
            </button>
            <span className="font-label-md text-label-md text-secondary w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
              className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-stone transition-colors"
            >
              <Icon name="zoom_in" size={22} />
            </button>
          </div>
        </div>
        {/* Image */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-surface-container-low/50">
          <img
            src={record.imageUrl}
            alt={record.title}
            className="max-w-full max-h-full object-contain shadow-lg border border-stone/50 bg-white rounded"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s ease' }}
          />
        </div>
        <div className="px-6 py-2 flex-shrink-0 text-center">
          <span className="font-label-md text-[10px] text-secondary uppercase tracking-widest">
            {record.id} · {record.type} · {record.year}
          </span>
        </div>
      </div>

      {/* Right: reading pane */}
      <div className="w-full md:w-1/2 flex flex-col overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-stone bg-parchment-bright sticky top-0 z-10 flex-shrink-0">
          {['transcript', 'translation', 'original'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-[60px] font-label-lg text-[13px] uppercase tracking-wider transition-colors border-b-2 ${
                tab === t
                  ? 'border-brass-patina text-brass-patina bg-surface-container-low'
                  : 'border-transparent text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              {t === 'transcript' ? 'Transcript' : t === 'translation' ? 'हिंदी अनुवाद' : 'Document'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 pb-24 md:pb-10">
          {/* Status + title */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <span className="px-3 py-1 bg-stone font-label-md text-label-md text-on-surface-variant rounded-sm uppercase text-[11px]">
              {record.type}
            </span>
            {record.verified && (
              <span className="flex items-center gap-1 px-3 py-1 bg-verified-green/10 text-verified-green border border-verified-green/20 font-label-md text-[11px] rounded-sm uppercase">
                <Icon name="verified" size={12} filled /> Verified Archive
              </span>
            )}
          </div>
          <h2 className="font-headline-lg text-[clamp(24px,3vw,40px)] text-ink mb-3 leading-tight">{record.title}</h2>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 font-body-md text-[15px] text-on-surface-variant mb-6 pb-6 border-b border-stone">
            <div><dt className="inline font-semibold text-secondary">Date: </dt><dd className="inline">{record.year}</dd></div>
            <div><dt className="inline font-semibold text-secondary">ID: </dt><dd className="inline">{record.id}</dd></div>
            <div><dt className="inline font-semibold text-secondary">Author: </dt><dd className="inline">Dr. B. R. Ambedkar</dd></div>
          </dl>

          {/* Audio control (feature record only) */}
          {isFeature && (
            <div className="flex items-center gap-5 p-5 bg-parchment-bright border border-stone rounded-xl mb-6 shadow-sm">
              <button
                onClick={() => setPlaying(v => !v)}
                className="w-16 h-16 rounded-full bg-ink text-parchment-bright flex items-center justify-center hover:bg-brass-patina hover:text-ink transition-colors flex-shrink-0"
              >
                <Icon name={playing ? 'pause' : 'play_arrow'} size={32} filled />
              </button>
              <div className="flex-1">
                <strong className="font-label-lg text-label-lg text-ink block mb-2">
                  {tab === 'translation' ? 'हिंदी में सुनें' : 'Play Narrated Transcript'}
                </strong>
                <div
                  className="w-full h-2 bg-stone rounded-full cursor-pointer"
                  onClick={e => setProgress((e.nativeEvent.offsetX / e.currentTarget.offsetWidth) * 100)}
                >
                  <div className="h-full bg-brass-patina rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between mt-1 font-label-md text-label-md text-on-surface-variant">
                  <span>{fmt(progress * 2.63)} /</span>
                  <span>04:23</span>
                </div>
              </div>
            </div>
          )}

          {/* Text content */}
          {tab === 'original' ? (
            <div className="flex items-start gap-4 p-5 bg-surface-container rounded-xl border border-outline-variant/30">
              <Icon name="description" size={24} className="text-tertiary flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-headline-md text-[20px] text-primary font-semibold mb-2">Document facsimile</h3>
                <p className="font-body-md text-[16px] text-on-surface-variant leading-relaxed">
                  The image shown is the archival scan. Switch to Transcript for the readable text layer or Hindi translation for the multilingual demonstration.
                </p>
              </div>
            </div>
          ) : (
            <div className={`flex flex-col gap-5 ${tab === 'translation' ? 'font-["Noto_Serif_Devanagari",serif]' : ''}`}>
              {(isFeature ? text : [record.description]).map((p, i) => (
                <p key={i} className="font-body-lg text-[clamp(18px,1.8vw,22px)] text-ink leading-relaxed">
                  {p}
                  {isFeature && <sup className="text-tertiary font-label-md text-[10px] ml-1">{i + 1}</sup>}
                </p>
              ))}
              {tab === 'translation' && (
                <div className="flex items-start gap-3 p-4 bg-ai-assisted-blue/5 border border-ai-assisted-blue/20 rounded-xl mt-2">
                  <Icon name="language" size={18} className="text-ai-assisted-blue flex-shrink-0 mt-0.5" />
                  <p className="font-label-md text-label-md text-ai-assisted-blue leading-relaxed">
                    <strong className="block text-primary mb-1">Demonstration translation</strong>
                    This Hindi text is hardcoded for the frontend prototype and should be replaced by a reviewed institutional translation before publication.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Related records */}
          {isFeature && (
            <div className="mt-8 pt-6 border-t border-stone">
              <h3 className="font-headline-md text-[22px] text-primary font-semibold mb-4">Continue through the archive</h3>
              <div className="flex flex-col gap-3">
                {records.slice(1, 4).map(r => (
                  <button
                    key={r.id}
                    onClick={() => onOpenRecord(r)}
                    className="flex items-center gap-4 p-4 border border-outline-variant/40 rounded-xl bg-parchment-bright hover:bg-surface-container-low text-left active:scale-[0.98] transition-all"
                  >
                    <span className="font-label-lg text-label-lg text-tertiary font-bold w-12 flex-shrink-0">{r.year}</span>
                    <strong className="flex-1 font-body-md text-[16px] text-primary">{r.title}</strong>
                    <Icon name="arrow_forward" size={18} className="text-tertiary flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
