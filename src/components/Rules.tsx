import React from "react";
import BookOpenIcon from "./icons/BookOpenIcon";

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5 mb-6 shadow-md">
    <h2 className="text-xl font-bold text-green-500 mb-3 flex items-center gap-2">
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
        <ul className="list-disc ml-6">
        <li>Het team dat aan het einde van de wedstrijd de meeste doelpunten heeft, wint.</li>
        </ul>
        </Section>

      <Section title="Sportiviteit & Respect">
        <ul className="list-disc ml-6">
        <li>We spelen voor ons plezier en vinden sportiviteit en respect voor elkaar heel belangrijk. Onsportief gedrag en blessures moeten zoveel mogelijk worden voorkomen. Iedereen die zich onsportief of agressief gedraagt, wordt hierop aangesproken.</li>
<li>Het is de bedoeling dat iedereen in een veilige en prettige sfeer kan spelen, voor, tijdens, en na de wedstrijd.</li>
<li>Wie herhaaldelijk ongewenst gedrag vertoont, kan worden geschorst of zelfs uit de vereniging worden gezet.</li>
    </ul>
</Section>

      <Section title="Algemene Spelregels">
        <ul className="list-disc ml-6">
          <li>Een wedstrijd duurt meestal 50 minuten, maar deze tijd kan worden aangepast als dat duidelijk wordt afgesproken.</li>
          <li>Zodra de tijd (op de klok van de sporthal) om is, stopt de wedstrijd direct (geen blessuretijd). Als er nog een penalty genomen moet worden, mag dat nog wel. Dit geldt ook voor een eventuele pauze indien er met 4 in een team gespeeld wordt. Die pauze duurt 5min na 25 min speeltijd.</li>
          <li>Halverwege de wedstrijd kan er van speelhelft gewisseld worden als één van de teams dat wil. Als beide teams geen behoefte hebben aan het wisselen van helft, hoeft het niet.</li>
          <li>De grootte van de teams hangt af van de zaal en het aantal spelers. In een zaal van een derde van een zaalvoetbalveld spelen we 4 tegen 4, inclusief keepers, of in teams van 5 met een wissel</li>
        </ul>
      </Section>

      <Section title="Wisselen">
        <ul className="list-disc ml-6">
          <li>Als er 5 spelers in een team zijn, wordt er gespeeld met wissels.</li>
          <li>De volgorde van wisselen staat op het wedstrijdformulier. De eerste wedstrijd wordt er van boven naar beneden gewisseld en de tweede wedstrijd van beneden naar boven.</li>
          <li>Er dient elke 5 minuten gewisseld te worden. Zodra het tijd is én de keeper heeft de bal vast wordt er gewisseld.</li>
          <li>Als de wedstrijd niet in een 5 minuten kader begint pak je de meest logische wisselstand ( bijv. Bij 12min over, wissel je om 15min over. En bij 13min over, wissel je om 20min over)</li>
          <li>Wissels houden de score bij.</li>
          <li>Bij een wisselende keeper wisselt de keeper mee zoals op het wedstijdformulier is aangegeven. Bij een vaste keeper wisselt de keeper niet.</li>
        </ul>
      </Section>

      <Section title="Speelveld">
        <ul className="list-disc ml-6">
          <li>We spelen meestal in een zaal van een derde van een zaalvoetbalveld.</li>
          <li>Er zijn geen lijnen aan de zijkanten of achterkant, dus de bal blijft altijd in het spel. De enige uitzondering is als de bal op of achter het doel komt (dan is het keeperbal).</li>
          <li>Komt de bal op de tribune en stuitert hij, zonder bemoeienis van toeschouwers, terug het veld in? Dan gaat het spel gewoon door.</li>
          <li>Het keepersgebied wordt aangegeven door een halve cirkel rond het doel. Het doel zelf staat met de palen op de achterlijn, die dient als doellijn. Mocht het zijn dat de doelpalen over de doellijn staan, dan is de (denkbeeldige) doellijn tussen de palen.</li>
      <li>Spelers moeten rekening houden met de muren; contact moet vermeden worden om blessures te voorkomen.li>
       <li>In de zaal mag 1 bank staan ten behoeve van de wisselspelers, verder dient de zaal leeg te zijn van banken of andere attributen. Ook geen grote sporttassen op of bij de bank. Dit i.v.m. de veiligheid.</li>
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
