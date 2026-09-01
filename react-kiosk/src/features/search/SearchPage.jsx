import { useMemo, useState } from 'react';
import Icon from '../../components/ui/Icon';
import RecordCard from '../../components/ui/RecordCard';
import { records } from '../../data/archiveData';

const trendingIds = ['A-002', 'A-004', 'A-005', 'A-001'];
const trends = {
  'A-002': { change: '+34%', reason: 'Featured book' },
  'A-004': { change: '+28%', reason: 'Constitution focus' },
  'A-005': { change: '+21%', reason: 'Civil rights story' },
  'A-001': { change: '+18%', reason: 'Most cited writing' },
};

function score(record, rawQuery) {
  const query = rawQuery.toLowerCase().trim();
  if (!query) return 0;
  const title = record.title.toLowerCase();
  const tags = record.tags.join(' ').toLowerCase();
  let value = 0;
  if (title === query) value += 100;
  if (title.startsWith(query)) value += 50;
  if (title.includes(query)) value += 30;
  if (tags.includes(query)) value += 20;
  if (record.type.toLowerCase().includes(query)) value += 12;
  if (record.year.includes(query)) value += 10;
  if (record.description.toLowerCase().includes(query)) value += 6;
  return value;
}

export default function SearchPage({ language, onOpen }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('All');
  const kinds = ['All', 'Document', 'Book', 'Audio', 'Video'];
  const searching = query.trim().length > 0;
  const trending = trendingIds.map(id => records.find(record => record.id === id));
  const results = useMemo(() => records
    .map(record => ({ record, relevance: score(record, query) }))
    .filter(item => item.relevance > 0 && (kind === 'All' || item.record.mediaKind === kind))
    .sort((a, b) => b.relevance - a.relevance)
    .map(item => item.record), [query, kind]);

  return (
    <div className="h-full overflow-y-auto page-enter">
      <header className="relative overflow-hidden border-b border-outline-variant/35 bg-surface-container-low px-8 pb-8 pt-9 md:px-16">
        <div className="absolute -right-24 -top-32 h-80 w-80 rounded-full border border-tertiary/15" />
        <p className="font-label-md text-[11px] font-bold uppercase tracking-[.2em] text-tertiary">{language === 'हिंदी' ? 'खोज और खोजबीन' : 'SEARCH & DISCOVERY'}</p>
        <h1 className="mt-2 font-headline-lg text-[clamp(38px,5vw,62px)] font-semibold leading-none">{language === 'हिंदी' ? 'क्या खोजना है?' : 'What are you looking for?'}</h1>
        <label className="relative mt-8 flex min-h-[68px] max-w-5xl items-center gap-4 border-b-2 border-primary bg-transparent transition focus-within:border-tertiary">
          <Icon name="search" size={31} className="text-tertiary" />
          <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={language === 'हिंदी' ? 'नाम, वर्ष, भाषण या विचार…' : 'A name, year, speech or idea…'} className="min-w-0 flex-1 border-0 bg-transparent font-body-lg text-[clamp(21px,2.3vw,30px)] text-primary outline-none placeholder:text-outline" />
          {query && <button onClick={() => setQuery('')} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-container-high" aria-label="Clear search"><Icon name="close" size={22} /></button>}
        </label>
        <div className="mt-5 flex flex-wrap gap-2">
          {kinds.map(item => <button key={item} onClick={() => setKind(item)} className={`min-h-10 rounded-full border px-5 font-label-md text-[11px] font-semibold ${kind === item ? 'border-primary bg-primary text-white' : 'border-outline-variant bg-transparent text-secondary hover:border-tertiary'}`}>{item}</button>)}
        </div>
      </header>

      <section className="px-8 py-8 md:px-16">
        {!searching ? (
          <>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div><p className="font-label-md text-[10px] font-bold uppercase tracking-[.2em] text-tertiary">CURATED FOR THE KIOSK</p><h2 className="mt-1 font-headline-md text-[34px] font-semibold">{language === 'हिंदी' ? 'अभी लोकप्रिय' : 'Trending now'}</h2></div>
              <p className="hidden max-w-sm text-right font-body-md text-[14px] leading-relaxed text-secondary md:block">{language === 'हिंदी' ? 'हाल में सबसे अधिक देखे गए विषय और अभिलेख।' : 'A rotating selection of the stories visitors are exploring most.'}</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {trending.map((record, index) => (
                <button key={record.id} onClick={() => onOpen(record)} className="group relative min-h-[310px] overflow-hidden rounded-2xl bg-primary text-left text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl active:scale-[.98]">
                  <img src={record.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover grayscale opacity-70 transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/5" />
                  <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/35 font-headline-md text-[21px]">{index + 1}</span>
                  <span className="absolute right-4 top-4 rounded-full bg-tertiary-container px-3 py-1 font-label-md text-[10px] font-bold text-on-tertiary-container">{trends[record.id].change}</span>
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <p className="font-label-md text-[10px] uppercase tracking-[.16em] text-tertiary-fixed">{trends[record.id].reason}</p>
                    <h3 className="mt-2 font-headline-md text-[25px] font-semibold leading-tight">{record.title}</h3>
                    <p className="mt-2 font-label-md text-[10px] uppercase tracking-wider text-white/60">{record.type} · {record.year}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-9 grid gap-4 border-t border-outline-variant/35 pt-7 md:grid-cols-3">
              {[['gavel', 'Constitution', '1946–1950'], ['water_drop', 'Civil rights', 'Mahad, 1927'], ['menu_book', 'Buddhism', 'Dhamma & society']].map(item => <button key={item[1]} onClick={() => setQuery(item[1])} className="flex min-h-20 items-center gap-4 rounded-xl bg-surface-container-low px-5 text-left transition hover:bg-surface-container"><Icon name={item[0]} size={25} className="text-tertiary" /><span><strong className="block font-body-md text-[17px]">{item[1]}</strong><small className="font-label-md text-[10px] uppercase tracking-wider text-secondary">{item[2]}</small></span></button>)}
            </div>
          </>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between"><p className="font-label-md text-[11px] uppercase tracking-widest text-secondary">{results.length} {language === 'हिंदी' ? 'प्रासंगिक परिणाम' : 'relevant results'}</p><span className="font-label-md text-[10px] text-secondary">{language === 'हिंदी' ? 'प्रासंगिकता के अनुसार' : 'Ordered by relevance'}</span></div>
            {results.length ? <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">{results.map(record => <RecordCard key={record.id} compact record={record} onOpen={onOpen} />)}</div> : <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant text-center"><Icon name="search_off" size={46} className="text-tertiary" /><h2 className="mt-4 font-headline-md text-[26px]">No matching records</h2><p className="mt-2 text-secondary">Try “Buddha”, “caste”, “1949” or “speech”.</p></div>}
          </>
        )}
      </section>
    </div>
  );
}
