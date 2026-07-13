import { useEffect, useState } from "react"
import { auth } from "@clerk/tanstack-react-start/server"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { useMutation, useQuery } from "convex/react"
import { RefreshCcwIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"

import { api } from "../../convex/_generated/api"
import type { Plan } from "../../convex/plans"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"

const requireAdmin = createServerFn().handler(async () => {
  const { isAuthenticated, sessionClaims } = await auth()
  if (!isAuthenticated)
    throw redirect({ to: "/sign-in/$", params: { _splat: "" } })
  if (sessionClaims?.metadata?.role !== "admin") throw redirect({ to: "/" })
})

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => await requireAdmin(),
  component: AdminPage,
})

const planOptions: Array<{
  value: Plan
  label: string
  price: string
}> = [
  { value: "free", label: "Free", price: "$0 / month" },
  { value: "premium", label: "Premium", price: "$20 / month" },
  { value: "max", label: "Max", price: "$100 / month" },
]

function AdminPage() {
  const account = useQuery(api.accounts.getMyPlan)
  const llmUsage = useQuery(api.llm.usage.getMyWeeklyUsage)
  const ttsUsage = useQuery(api.tts.usage.getMyWeeklyUsage)
  const setMyPlan = useMutation(api.accounts.setMyPlan)
  const resetMyWeeklyUsage = useMutation(api.accounts.resetMyWeeklyUsage)
  const [selectedPlan, setSelectedPlan] = useState<Plan>("free")
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    if (account) setSelectedPlan(account.plan)
  }, [account])

  async function handleSavePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    try {
      await setMyPlan({ plan: selectedPlan })
      toast.success("Plan updated")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update plan"
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleResetUsage() {
    setIsResetting(true)
    try {
      await resetMyWeeklyUsage({})
      toast.success("Weekly usage reset")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not reset usage"
      )
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <main className="min-h-[calc(100svh-5rem)] w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Subscription plan</CardTitle>
            <CardDescription>
              Change your plan for testing. Administrator access remains a
              separate Clerk metadata flag.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSavePlan}>
            <CardContent>
              <FieldSet disabled={!account || isSaving}>
                <FieldLegend>Select a plan</FieldLegend>
                <FieldGroup>
                  {planOptions.map((plan) => (
                    <Field key={plan.value} orientation="horizontal">
                      <input
                        id={`plan-${plan.value}`}
                        name="plan"
                        type="radio"
                        value={plan.value}
                        checked={selectedPlan === plan.value}
                        className="size-4"
                        onChange={() => setSelectedPlan(plan.value)}
                      />
                      <FieldLabel htmlFor={`plan-${plan.value}`}>
                        {plan.label}
                      </FieldLabel>
                      <FieldDescription>{plan.price}</FieldDescription>
                    </Field>
                  ))}
                </FieldGroup>
              </FieldSet>
            </CardContent>
            <CardFooter className="justify-end pt-6">
              <Button
                type="submit"
                disabled={!account || selectedPlan === account.plan || isSaving}
              >
                {isSaving ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SaveIcon data-icon="inline-start" />
                )}
                Save plan
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly usage</CardTitle>
            <CardDescription>
              Reset both allowances to their full amount for your current plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <dt className="text-sm text-muted-foreground">LLM tokens</dt>
                <dd className="font-medium">
                  {llmUsage
                    ? `${llmUsage.remaining.toLocaleString()} / ${llmUsage.limit.toLocaleString()} left`
                    : "Loading…"}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-sm text-muted-foreground">
                  TTS characters
                </dt>
                <dd className="font-medium">
                  {ttsUsage
                    ? `${ttsUsage.remaining.toLocaleString()} / ${ttsUsage.limit.toLocaleString()} left`
                    : "Loading…"}
                </dd>
              </div>
            </dl>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              type="button"
              variant="destructive"
              disabled={!llmUsage || !ttsUsage || isResetting}
              onClick={handleResetUsage}
            >
              {isResetting ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCcwIcon data-icon="inline-start" />
              )}
              Reset remaining tokens
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}
