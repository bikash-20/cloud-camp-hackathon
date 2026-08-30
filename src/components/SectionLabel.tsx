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
          style={{
            background: 'none',
            border: 'none',
            padding: '4px 6px',
            fontFamily: 'Inter',
            fontSize: 11,
            fontWeight: 600,
            color: T.primary,
            cursor: 'pointer',
            minHeight: 24,
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}