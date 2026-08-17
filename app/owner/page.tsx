import RegistrationForm from "../components/RegistrationForm";
import RegistrationPageShell from "../components/RegistrationPageShell";

export default function OwnerRegistrationPage() {
  return (
    <RegistrationPageShell
      title="Owner Registration"
      description="Create your owner account"
    >
      <RegistrationForm title="Owner Registration" />
    </RegistrationPageShell>
  );
}
