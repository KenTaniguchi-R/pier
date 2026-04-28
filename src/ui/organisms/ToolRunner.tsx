import type { Parameter, ParamValue } from "../../domain/tool";
import type { ValidationError } from "../../domain/paramValidation";
import { ParamField } from "../molecules/ParamField";
import { AdvancedDisclosure } from "../molecules/AdvancedDisclosure";

interface Props {
  params: Parameter[];
  values: Record<string, ParamValue>;
  errors?: Map<string, ValidationError>;
  onChange: (id: string, v: ParamValue) => void;
}

/**
 * Presentational form for a tool's parameters. Pure: no app/runner hooks,
 * no run orchestration. ToolDetail owns the state via useToolRun.
 */
export function ToolRunner({ params, values, errors, onChange }: Props) {
  const required = params.filter(p => !p.advanced);
  const advanced = params.filter(p => p.advanced);

  return (
    <div className="flex flex-col gap-7">
      {required.map((p, i) => (
        <ParamField
          key={p.id}
          param={p}
          index={i}
          value={values[p.id]}
          error={errors?.get(p.id)}
          onChange={v => onChange(p.id, v)}
        />
      ))}

      {advanced.length > 0 && (
        <AdvancedDisclosure params={advanced} values={values} errors={errors} onChange={onChange} />
      )}
    </div>
  );
}
