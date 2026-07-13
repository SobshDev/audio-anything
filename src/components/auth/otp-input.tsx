import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

/**
 * A 6-digit verification code input used across every code-based step
 * (email code sign-in, MFA, password reset, and sign-up email verification).
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  autoFocus?: boolean
}) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      autoFocus={autoFocus}
      containerClassName="justify-center"
      aria-invalid={invalid}
    >
      <InputOTPGroup>
        {Array.from({ length: 6 }).map((_, index) => (
          <InputOTPSlot key={index} index={index} aria-invalid={invalid} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}
