import SiteHeader from "@/components/SiteHeader";
import Hero from "@/components/Hero";
import ProgramsSection, { type RidingLevelKey } from "@/components/ProgramsSection";
import MethodSection from "@/components/MethodSection";
import StorySection from "@/components/StorySection";
import CtaBanner from "@/components/CtaBanner";
import SiteFooter from "@/components/SiteFooter";
import { getAllActivePlans } from "@/lib/plans";

export default async function HomePage() {
  const activePlans = await getAllActivePlans();
  const plansByLevel = activePlans.reduce(
    (acc, plan) => {
      acc[plan.level].push(plan);
      return acc;
    },
    { foundation: [], progression: [], performance: [], elite: [] } as Record<
      RidingLevelKey,
      typeof activePlans
    >
  );

  return (
    <>
      <SiteHeader />
      <main id="top">
        <Hero />
        <ProgramsSection plans={plansByLevel} />
        <MethodSection />
        <StorySection />
        <CtaBanner />
      </main>
      <SiteFooter />
    </>
  );
}
