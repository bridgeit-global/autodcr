import RegistrationForm from "../components/RegistrationForm";
import SiteFooter from "../components/SiteFooter";

export default function OwnerRegistrationPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <main className="py-8">
        <RegistrationForm title="Owner Registration" />
      </main>
      <SiteFooter />
    </div>
  );
}

