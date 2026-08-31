import Icon from '../ui/Icon';

const navItems = [
  { id: 'home', icon: 'home', en: 'Home', hi: 'मुखपृष्ठ' },
  { id: 'browse', icon: 'grid_view', en: 'Browse', hi: 'संग्रह' },
  { id: 'search', icon: 'search', en: 'Search', hi: 'खोज' },
  { id: 'timeline', icon: 'timeline', en: 'Timeline', hi: 'समयरेखा' },
  { id: 'ask', icon: 'contact_support', en: 'Ask', hi: 'पूछें' },
];

export default function AppShell({ page, language, secondsLeft, onNavigate, onLanguage, children }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-on-surface">
      <header className="flex h-20 shrink-0 items-center justify-between border-b border-tertiary/25 bg-surface px-6 md:px-10">
        <button onClick={() => onNavigate('home')} className="flex items-center gap-3 text-left" aria-label="Go home">
          <Icon name="language" size={28} className="text-primary" />
          <span className="font-headline-md text-[18px] font-bold uppercase tracking-[.16em] text-primary md:text-[22px]">Ambedkar Digital Heritage</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-outline-variant/60 px-4 py-2 font-label-md text-[12px] text-secondary sm:flex">
            <Icon name="timer" size={17} /> {secondsLeft}s
          </div>
          <div className="flex rounded-full border border-outline-variant/70 bg-parchment-bright p-1">
            {['ENG', 'हिंदी'].map((item) => (
              <button key={item} onClick={() => onLanguage(item)} className={`min-h-10 rounded-full px-4 font-label-md text-[12px] font-semibold transition ${language === item ? 'bg-primary text-white' : 'text-secondary hover:bg-surface-container'}`}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-[118px] shrink-0 flex-col border-r border-tertiary/30 bg-surface-container-low md:flex">
          <div className="flex flex-1 flex-col justify-center gap-1">
            {navItems.map((item) => {
              const active = page === item.id;
              return (
                <button key={item.id} onClick={() => onNavigate(item.id)} className={`relative flex min-h-[92px] flex-col items-center justify-center gap-2 border-r-4 transition active:scale-95 ${active ? 'border-tertiary bg-tertiary-container text-on-tertiary-container' : 'border-transparent text-secondary hover:bg-surface-container'}`}>
                  <Icon name={item.icon} filled={active} size={29} />
                  <span className="font-label-md text-[12px] font-semibold">{language === 'हिंदी' ? item.hi : item.en}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => onNavigate('welcome')} className="flex min-h-16 items-center justify-center gap-2 border-t border-outline-variant/40 font-label-md text-[11px] uppercase tracking-wider text-secondary hover:bg-surface-container">
            <Icon name="restart_alt" size={18} /> Reset
          </button>
        </nav>

        <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>

      <nav className="flex h-[72px] shrink-0 border-t border-outline-variant/40 bg-surface-container-low md:hidden">
        {navItems.map((item) => {
          const active = page === item.id;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)} className={`flex flex-1 flex-col items-center justify-center gap-1 ${active ? 'bg-tertiary-container text-on-tertiary-container' : 'text-secondary'}`}>
              <Icon name={item.icon} filled={active} size={22} />
              <span className="font-label-md text-[10px]">{language === 'हिंदी' ? item.hi : item.en}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
