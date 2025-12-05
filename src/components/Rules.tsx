import React from "react";
import BookOpenIcon from "./icons/BookOpenIcon";

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5 mb-6 shadow-md">
    <h2 className="text-xl font-bold text-cyan-300 mb-3 flex items-center gap-2">
      <BookOpenIcon className="w-5 h-5" />
      {title}
    </h2>
    <div className="text-gray-300 text-sm leading-relaxed space-y-2">{children}</div>
  </div>
);

const Rules: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-2 pb-10">
      <h1 className="text-3xl font-extrabold text-white text-center mb-8">
        Bounceball Spelregels
      </h1>

      <Section title="Doel van het Spel">
        <p>Het team dat aan het einde van de wedstrijd de meeste doelpunten heeft, wint.</p>
      </Section>

      <Section title="Sportiviteit & Respect">
        <p>We spelen voor ons plezier en vinden sportiviteit en respect belangrijk. Ongewenst gedrag wordt aangesproken.</p>
        <p>Iedereen moet in een veilige omgeving kunnen spelen — voor, tijdens en na de wedstrijd.</p>
      </Section>

      <Section title="Algemene Spelregels">
        <ul className="list-disc ml-6">
          <li>Een wedstrijd duurt meestal 50 minuten.</li>
          <li>Bij het signaal van de klok stopt de wedstrijd direct (penalty mag nog).</li>
          <li>Speelhelft wisselen mag halverwege, indien gewenst.</li>
          <li>Teamgrootte: meestal 4 tegen 4, soms 5 met wissel.</li>
        </ul>
      </Section>

      <Section title="Wisselen">
        <ul className="list-disc ml-6">
          <li>Teams met 5 spelers gebruiken wissels.</li>
          <li>Elke 5 minuten wordt gewisseld wanneer de keeper de bal vast heeft.</li>
          <li>Wissels houden de score bij en bepalen keeper-regels.</li>
        </ul>
      </Section>

      <Section title="Speelveld">
        <ul className="list-disc ml-6">
          <li>We spelen op 1/3 zaalvoetbalveld.</li>
          <li>Geen uitballen aan de zijkant, spel gaat door.</li>
          <li>Keeperbal wanneer bal tegen/achter doel komt.</li>
          <li>Muren moeten worden vermeden i.v.m. veiligheid.</li>
        </ul>
      </Section>

      <Section title="Materiaal">
        <ul className="list-disc ml-6">
          <li>Een plastic bal, kleiner dan handbal.</li>
          <li>Tamponsticks van gelijke lengte per team.</li>
        </ul>
      </Section>

      <Section title="Spelverloop">
        <ul className="list-disc ml-6">
          <li>Bal mag alleen worden gespeeld met het zachte deel van de stick.</li>
          <li>Kopballen en aannemen met romp zijn toegestaan.</li>
          <li>Alleen schouderduwen toegestaan.</li>
        </ul>
      </Section>

      <Section title="Verdediging">
        <ul className="list-disc ml-6">
          <li>Verdedigen mag met “sfinx”-houding.</li>
          <li>Duisen of duiken is penalty.</li>
        </ul>
      </Section>

      <Section title="Doelpunten">
        <ul className="list-disc ml-6">
          <li>Doelpunt telt als de bal volledig over de doellijn is.</li>
          <li>Eigen doelpunt telt altijd.</li>
        </ul>
      </Section>

      <Section title="Vrijeslag & Penalty">
        <ul className="list-disc ml-6">
          <li>Vrijeslag bij overtredingen buiten het keepersgebied.</li>
          <li>Penalty bij overtredingen binnen het keepersgebied.</li>
        </ul>
      </Section>

      <Section title="Keeper">
        <ul className="list-disc ml-6">
          <li>Keeper mag handen/voeten gebruiken binnen de cirkel.</li>
          <li>6 seconden vasthouden maximaal.</li>
          <li>Buiten cirkel geen handen/voeten → penalty.</li>
        </ul>
      </Section>

      <Section title="Gebruik van de Stick">
        <ul className="list-disc ml-6">
          <li>Stick moet laag blijven bij hinderen.</li>
          <li>Stick mag alleen de bal raken.</li>
          <li>Speler zonder stick → lichaamscontact = penalty.</li>
        </ul>
      </Section>

      <Section title="Klassement">
        <p>
          3 punten voor winst, 1 voor gelijkspel, 0 bij verlies.
          Klassement op basis van gemiddelde punten per wedstrijd.
        </p>
      </Section>

      <Section title="Aanmelden & Afmelden">
        <ul className="list-disc ml-6">
          <li>Vaste leden hebben tot vrijdag 18:00 voorrang.</li>
          <li>Introducee mag 1e keer altijd meedoen.</li>
          <li>Aan-/afmelden tot zondag 23:59.</li>
        </ul>
      </Section>

      <p className="text-center text-gray-500 mt-10 text-xs">
        Laatste update: {new Date().toLocaleDateString("nl-NL")}
      </p>
    </div>
  );
};

export default Rules;
