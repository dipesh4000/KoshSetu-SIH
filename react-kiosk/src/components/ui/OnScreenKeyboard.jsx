import Icon from './Icon';

const englishRows = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['z','x','c','v','b','n','m'],
];

const hindiRows = [
  ['१','२','३','४','५','६','७','८','९','०'],
  ['क','ख','ग','घ','च','छ','ज','झ','ट','ठ'],
  ['ड','ढ','त','थ','द','ध','न','प','फ'],
  ['ब','भ','म','य','र','ल','व','श','स','ह'],
  ['ा','ि','ी','ु','ू','े','ै','ो','ौ','ं'],
];

export default function OnScreenKeyboard({ language, onKey, onBackspace, onClear, onClose }) {
  const rows = language === 'हिंदी' ? hindiRows : englishRows;
  return (
    <section className="shrink-0 border-t border-outline-variant/50 bg-[#e8e4d8] px-3 py-3 shadow-[0_-12px_30px_rgba(28,28,21,.08)]" aria-label="On-screen keyboard">
      <div className="mx-auto max-w-5xl">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="font-label-md text-[10px] font-bold uppercase tracking-[.16em] text-secondary">{language === 'हिंदी' ? 'ऑन-स्क्रीन कीबोर्ड' : 'On-screen keyboard'}</span>
          <button type="button" onClick={onClose} className="flex h-9 items-center gap-1 rounded-lg px-3 font-label-md text-[11px] font-semibold text-secondary hover:bg-white/60"><Icon name="keyboard_hide" size={18} /> {language === 'हिंदी' ? 'बंद करें' : 'Close'}</button>
        </div>
        <div className="space-y-1.5">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center gap-1.5">
              {row.map(key => <button type="button" key={key} onClick={() => onKey(key)} className="flex h-10 min-w-9 flex-1 items-center justify-center rounded-md border border-outline-variant/70 bg-parchment-bright font-label-md text-[15px] font-semibold text-primary shadow-sm transition active:translate-y-px active:bg-tertiary-container sm:max-w-[72px]">{key}</button>)}
            </div>
          ))}
          <div className="flex justify-center gap-1.5 pt-0.5">
            <button type="button" onClick={onClear} className="flex h-10 w-24 items-center justify-center rounded-md border border-outline-variant/70 bg-parchment-bright font-label-md text-[11px] font-semibold text-secondary">{language === 'हिंदी' ? 'साफ़ करें' : 'Clear'}</button>
            <button type="button" onClick={() => onKey(' ')} className="flex h-10 max-w-lg flex-1 items-center justify-center rounded-md border border-outline-variant/70 bg-parchment-bright font-label-md text-[11px] font-semibold text-secondary">{language === 'हिंदी' ? 'स्पेस' : 'Space'}</button>
            <button type="button" onClick={onBackspace} className="flex h-10 w-24 items-center justify-center rounded-md border border-outline-variant/70 bg-parchment-bright text-secondary" aria-label="Backspace"><Icon name="backspace" size={20} /></button>
          </div>
        </div>
      </div>
    </section>
  );
}
