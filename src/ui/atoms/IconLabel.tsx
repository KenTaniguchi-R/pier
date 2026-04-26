interface Props {
  icon: string;
  label: string;
}

export function IconLabel({ icon, label }: Props) {
  return (
    <span className="icon-label">
      <span className="icon-label__icon">{icon}</span>
      <span className="icon-label__label">{label}</span>
    </span>
  );
}
