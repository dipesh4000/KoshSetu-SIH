export default function Icon({ name, filled = false, size = 26, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${filled ? 'icon-filled' : ''} ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}
