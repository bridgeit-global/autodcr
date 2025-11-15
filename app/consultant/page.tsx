import ConsultantRegistrationForm from "../components/ConsultantRegistrationForm";
import SiteFooter from "../components/SiteFooter";

export default function OwnerRegistrationPage() {
  return (
    <div className="min-h-screen bg-white/90 text-zinc-900 backdrop-blur-sm">
      {/* <Header /> */}
      <main className="py-8">
        <ConsultantRegistrationForm title="Consultant Registration" />
      </main>
      <SiteFooter />
    </div>
  );
}

