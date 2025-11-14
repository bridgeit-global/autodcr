import Header from "../components/Header";
import RegistrationForm from "../components/RegistrationForm";
import SiteFooter from "../components/SiteFooter";

export default function OwnerRegistrationPage() {
  return (
    <div className="min-h-screen bg-white/90 text-zinc-900 backdrop-blur-sm">
      <Header />
      <main className="py-8">
        <RegistrationForm title="Owner Registration" />
      </main>
      <SiteFooter />
    </div>
  );
}

