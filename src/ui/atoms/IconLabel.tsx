interface Props {
  icon: string;
  label: string;
}

export function IconLabel({ icon, label }: Props) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[18px] leading-none">{icon}</span>
      <span className="font-body font-medium text-[14px] leading-none">{label}</span>
    </span>
  );
}
