import RegistrationForm from "../components/RegistrationForm";
import RegistrationPageShell from "../components/RegistrationPageShell";

export default function DeveloperRegistrationPage() {
  return (
    <RegistrationPageShell
      title="Developer Registration"
      description="Create your developer account"
    >
      <RegistrationForm title="Developer Registration" accountRole="Developer" />
    </RegistrationPageShell>
  );
}
