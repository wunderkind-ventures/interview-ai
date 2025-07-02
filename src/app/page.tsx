import HeroSection from "@/components/landing/hero-section";
import FeatureCards from "@/components/landing/feature-cards";
import Testimonials from "@/components/landing/testimonials";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <FeatureCards />
      <Testimonials />
    </div>
  );
}
