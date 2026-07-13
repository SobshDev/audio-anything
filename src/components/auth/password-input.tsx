import { useState } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

/**
 * Password field with a show/hide toggle, built on `InputGroup` so the toggle
 * button lives inside the input per shadcn composition rules.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  invalid,
  disabled,
  autoFocus,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  autoFocus?: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <InputGroup data-invalid={invalid ? "" : undefined}>
      <InputGroupInput
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={invalid}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          size="icon-xs"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((previous) => !previous)}
          disabled={disabled}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
