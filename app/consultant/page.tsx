import ConsultantRegistrationForm from "../components/ConsultantRegistrationForm";
import SiteFooter from "../components/SiteFooter";

export default function OwnerRegistrationPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* <Header /> */}
      <main className="py-8">
        <ConsultantRegistrationForm title="Consultant Registration" />
      </main>
      <SiteFooter />
    </div>
  );
}

