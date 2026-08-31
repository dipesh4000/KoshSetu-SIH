import Icon from './Icon';

export default function RecordCard({ record, onOpen, compact = false }) {
  return (
    <button
      onClick={() => onOpen(record)}
      className={`group overflow-hidden rounded-xl border border-outline-variant/50 bg-parchment-bright text-left transition-all hover:-translate-y-1 hover:border-tertiary/60 hover:shadow-lg active:scale-[.98] ${compact ? 'flex min-h-36' : 'flex flex-col'}`}
    >
      <div className={`relative overflow-hidden bg-surface-container-high ${compact ? 'w-44 shrink-0' : 'h-48 w-full'}`}>
        <img src={record.imageUrl} alt="" className="h-full w-full object-cover grayscale transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <span className="absolute left-3 top-3 rounded bg-black/75 px-2 py-1 font-label-md text-[11px] uppercase tracking-widest text-white">
          {record.mediaKind}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="mb-2 flex items-center justify-between gap-3 font-label-md text-[12px] uppercase tracking-wider text-secondary">
          <span>{record.type}</span><span className="font-bold text-tertiary">{record.year}</span>
        </div>
        <h3 className="font-headline-md text-[22px] font-semibold leading-tight text-primary">{record.title}</h3>
        {!compact && <p className="mt-2 line-clamp-2 flex-1 font-body-md text-[15px] leading-relaxed text-on-surface-variant">{record.description}</p>}
        <div className="mt-4 flex items-center justify-between border-t border-outline-variant/30 pt-3">
          <span className="font-label-md text-[12px] text-secondary">{record.id}</span>
          <span className="flex items-center gap-1 font-label-md text-[13px] font-semibold text-tertiary">Open media <Icon name="arrow_forward" size={17} /></span>
        </div>
      </div>
    </button>
  );
}
