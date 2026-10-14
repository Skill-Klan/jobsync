import { Button } from "@/components/ui/button";

// The only way into SkillKlan Job: from the SkillKlan cabinet. There is no
// password here to type, so the page just sends people back to the cabinet —
// and says so plainly when a sign-in from it did not go through.
export default function CabinetSignin({
  cabinetUrl,
  failed,
}: {
  cabinetUrl: string | null;
  failed: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">SkillKlan Job</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your job search, powered by AI
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-xs">
        <h2 className="text-xl font-semibold">Sign in from your cabinet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Open your SkillKlan cabinet and press “SkillKlan Job” — you will be
          signed in here automatically.
        </p>
        {failed && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            That sign-in did not go through. Open SkillKlan Job from your
            cabinet again.
          </p>
        )}
        {cabinetUrl && (
          <Button asChild className="mt-6 w-full">
            <a href={cabinetUrl}>Open the cabinet</a>
          </Button>
        )}
      </div>
    </div>
  );
}
