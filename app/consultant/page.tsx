import ConsultantRegistrationForm from "../components/ConsultantRegistrationForm";
import RegistrationPageShell from "../components/RegistrationPageShell";

export default function ConsultantRegistrationPage() {
  return (
    <RegistrationPageShell
      title="Consultant Registration"
      description="Create your consultant account"
    >
      <ConsultantRegistrationForm title="Consultant Registration" />
    </RegistrationPageShell>
  );
}
