"use client";

interface Tab {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export default function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <div
      className="flex gap-1"
      style={{ borderBottom: "1px solid var(--border)", marginBottom: 20 }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: isActive ? "var(--accent)" : "var(--text2)",
              borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
              transition: "color 0.15s, border-color 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
            }}
            onMouseLeave={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "var(--text2)";
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
