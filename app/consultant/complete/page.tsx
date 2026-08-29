import ConsultantRegistrationForm from "../../components/ConsultantRegistrationForm";
import RegistrationPageShell from "../../components/RegistrationPageShell";

type ConsultantCompletePageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ConsultantCompletePage({
  searchParams,
}: ConsultantCompletePageProps) {
  const params = await searchParams;
  const token = params.token?.trim() || "";

  return (
    <RegistrationPageShell
      title="Complete Your Registration"
      description="Finish your consultant account setup"
    >
      <ConsultantRegistrationForm
        title="Complete Your Registration"
        inviteToken={token || undefined}
      />
    </RegistrationPageShell>
  );
}
