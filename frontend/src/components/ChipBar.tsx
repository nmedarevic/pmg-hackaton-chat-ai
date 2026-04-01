type ChipOption = { label: string; value: string };

type ChipBarProps = {
  options: ChipOption[];
  onSelect: (label: string) => void;
};

export const ChipBar = ({ options, onSelect }: ChipBarProps) => {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "8px",
        padding: "8px 16px 4px",
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.label)}
          style={{
            border: "1.5px solid var(--str-chat__primary-color, #006cff)",
            background: "transparent",
            color: "var(--str-chat__primary-color, #006cff)",
            borderRadius: "999px",
            padding: "5px 14px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};
