import { useMemo, useState } from 'react';
import Icon from '../../components/ui/Icon';
import RecordCard from '../../components/ui/RecordCard';
import { records } from '../../data/archiveData';

export default function SearchPage({ language, onOpen }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('All');
  const kinds = ['All', 'Document', 'Book', 'Audio'];
  const results = useMemo(() => records.filter(record => {
    const haystack = `${record.title} ${record.type} ${record.year} ${record.tags.join(' ')}`.toLowerCase();
    return (kind === 'All' || record.mediaKind === kind) && haystack.includes(query.trim().toLowerCase());
  }), [query, kind]);

  return (
    <div className="h-full overflow-y-auto px-8 py-10 page-enter md:px-16">
      <p className="font-label-md text-[12px] font-bold uppercase tracking-[.2em] text-tertiary">{language === 'हिंदी' ? 'खोज और खोजबीन' : 'SEARCH & DISCOVERY'}</p>
      <h1 className="mt-2 font-headline-lg text-[clamp(38px,5vw,64px)] font-semibold leading-none">{language === 'हिंदी' ? 'अभिलेख खोजें' : 'Find a record'}</h1>
      <label className="mt-8 flex min-h-20 max-w-5xl items-center gap-4 rounded-2xl border-2 border-outline-variant/60 bg-parchment-bright px-6 shadow-sm focus-within:border-tertiary">
        <Icon name="search" size={30} className="text-tertiary" />
        <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={language === 'हिंदी' ? 'शीर्षक, वर्ष या विचार खोजें…' : 'Search a title, year or idea…'} className="min-w-0 flex-1 border-0 bg-transparent font-body-md text-[22px] text-primary outline-none placeholder:text-outline" />
        {query && <button onClick={() => setQuery('')} className="flex h-12 w-12 items-center justify-center rounded-full hover:bg-surface-container"><Icon name="close" size={22} /></button>}
      </label>
      <div className="my-6 flex flex-wrap gap-3">
        {kinds.map(item => <button key={item} onClick={() => setKind(item)} className={`min-h-11 rounded-full border px-5 font-label-md text-[12px] font-semibold ${kind === item ? 'border-primary bg-primary text-white' : 'border-outline-variant bg-surface-container-low text-secondary'}`}>{item}</button>)}
      </div>
      <p className="mb-5 font-label-md text-[12px] uppercase tracking-widest text-secondary">{results.length} {language === 'हिंदी' ? 'परिणाम' : 'results'}</p>
      {results.length ? <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">{results.map(record => <RecordCard key={record.id} compact record={record} onOpen={onOpen} />)}</div> : <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant text-center"><Icon name="search_off" size={46} className="text-tertiary" /><h2 className="mt-4 font-headline-md text-[26px]">No matching records</h2><p className="mt-2 text-secondary">Try “Buddha”, “caste”, “1949” or “speech”.</p></div>}
    </div>
  );
}
