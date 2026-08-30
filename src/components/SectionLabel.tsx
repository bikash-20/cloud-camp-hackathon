import { T } from '../data';

interface SectionLabelProps {
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}

/** Small uppercase label used above sections in ProfileScreen and GroceryScreen. */
export default function SectionLabel({ children, action, onAction }: SectionLabelProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: '0 0 10px',
      }}
    >
      <div
        style={{
          fontFamily: 'Inter',
          fontSize: 11,
          fontWeight: 600,
          color: T.inkSoft,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {children}
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          aria-label={typeof action === 'string' ? action : 'Action'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(74, 58, 52, 0.08)',
            border: '1px solid rgba(74, 58, 52, 0.18)',
            padding: '5px 10px',
            borderRadius: 999,
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: 600,
            color: T.primary,
            cursor: 'pointer',
            minHeight: 28,
            transition: 'background 160ms ease, transform 160ms ease, box-shadow 160ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(74, 58, 52, 0.14)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(74, 58, 52, 0.08)';
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}