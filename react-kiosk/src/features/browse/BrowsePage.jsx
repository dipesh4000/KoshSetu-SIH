import RecordCard from '../../components/ui/RecordCard';
import Icon from '../../components/ui/Icon';
import { records } from '../../data/archiveData';

export default function BrowsePage({ language, onOpen, onNavigate }) {
  return (
    <div className="h-full overflow-y-auto page-enter">
      <section className="relative overflow-hidden border-b border-outline-variant/30 bg-surface-container-low px-8 py-10 md:px-16 md:py-14">
        <div className="absolute -right-28 -top-32 h-96 w-96 rounded-full border border-tertiary/20" />
        <p className="font-label-md text-[12px] font-bold uppercase tracking-[.2em] text-tertiary">{language === 'हिंदी' ? 'अभिलेख संग्रह' : 'THE PUBLIC COLLECTION'}</p>
        <div className="mt-3 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h1 className="font-headline-lg text-[clamp(38px,5vw,64px)] font-semibold leading-none text-primary">{language === 'हिंदी' ? 'अभिलेख देखें' : 'Browse the archive'}</h1>
            <p className="mt-4 max-w-2xl font-body-md text-[18px] leading-relaxed text-secondary">{language === 'हिंदी' ? 'लेखन, भाषण, पुस्तकें और संवैधानिक बहसें एक ही मीडिया अनुभव में।' : 'Writings, speeches, books and constitutional debates — every record opens in one media experience.'}</p>
          </div>
          <button onClick={() => onNavigate('search')} className="flex min-h-14 items-center gap-3 rounded-xl border border-outline-variant bg-parchment-bright px-6 font-label-md text-[14px] font-semibold text-primary shadow-sm hover:border-tertiary"><Icon name="search" size={21} /> {language === 'हिंदी' ? 'संग्रह खोजें' : 'Search collection'}</button>
        </div>
      </section>

      <section className="px-8 py-9 md:px-16">
        <div className="mb-6 flex items-center justify-between">
          <p className="font-label-md text-[12px] uppercase tracking-widest text-secondary">{records.length} records · 1891—1981</p>
          <div className="flex items-center gap-2 text-verified-green"><Icon name="verified" size={17} filled /><span className="font-label-md text-[11px] font-semibold uppercase tracking-wider">Curated demo archive</span></div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {records.map(record => <RecordCard key={record.id} record={record} onOpen={onOpen} />)}
        </div>
      </section>
    </div>
  );
}
