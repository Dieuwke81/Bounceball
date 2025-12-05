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
      <li>Spelers moeten rekening houden met de muren; contact moet vermeden worden om blessures te voorkomen.</li>
       <li>In de zaal mag 1 bank staan ten behoeve van de wisselspelers, verder dient de zaal leeg te zijn van banken of andere attributen. Ook geen grote sporttassen op of bij de bank. Dit i.v.m. de veiligheid.</li>
        </ul>
      </Section>

      <Section title="Materiaal">
        <ul className="list-disc ml-6">
          <li>We spelen Bounceball met een plastic bal, kleiner dan een handbal en groter dan een honkbal.</li>
          <li>Elke speler gebruikt een tamponstick. Alle sticks moeten dezelfde grootte hebben en niet aangepast zijn. Elk team gebruikt dezelfde kleur sticks.</li>
        </ul>
      </Section>

      <Section title="Spelverloop">
        <ul className="list-disc ml-6">
          <li>De bal mag alleen verplaatst worden door het zachte gedeelte van de stick. Kopbal of aannemen met de romp is toegestaan.</li>
          <li>De bal mag zowel over de grond als door de lucht gespeeld worden.</li>
          <li>De bal mag alleen met de stick worden afgepakt; lichamelijk contact is beperkt tot schouderduwen.</li>
       <li>Raakt de bal onbedoeld een been, voet, hand of arm? Dan gaat het spel door. Bij opzettelijk gebruik van deze lichaamsdelen volgt een vrijeslag.</li>
        </ul>
      </Section>

      <Section title="Verdediging">
        <ul className="list-disc ml-6">
          <li>Een verdediger mag in de ‘sfinx’-houding een schot blokkeren door op één knie te gaan zitten en zijn stick voor zich te houden.</li>
          <li>Andere verdedigende bewegingen, zoals voor de bal duiken, zijn niet toegestaan en worden bestraft met een penalty.</li>
        </ul>
      </Section>

      <Section title="Doelpunten">
        <ul className="list-disc ml-6">
          <li>Een doelpunt is geldig als de bal volledig en op correcte wijze over de doellijn gaat, waarbij de bal als laatste met het tampongedeelte van de stick is geraakt.</li>
          <li>Een eigen doelpunt telt altijd, ongeacht hoe de bal wordt geraakt.</li>
          <li>Na een doelpunt brengt de keeper de bal terug in het spel door deze eerst met de hand vast te pakken.</li>
        </ul>
      </Section>

      <Section title="Vrijeslag & Penalty">
  <ul className="list-disc ml-6">
    <li>Een vrijeslag wordt gegeven bij een overtreding buiten het keepersgebied.</li>

    <li>
      De volgende acties zijn overtredingen:
      <ul className="list-disc ml-6">
        <li>Een tegenstander vasthouden.</li>
        <li>De bal opzettelijk tegenhouden met been, voet, hand of arm.</li>
        <li>Foutief gebruik van de stick.</li>
        <li>Iemand raken met de stick op de benen.</li>
      </ul>
    </li>

    <li>
      Een vrijeslag mag direct op doel geschoten worden. Tegenstanders mogen een muur opstellen,
      maar deze moet minstens twee sticks afstand hebben tot de bal.
    </li>

    <li>
      Een penalty volgt bij een overtreding binnen het keepersgebied. De bal ligt dan op de lijn van
      het keepersgebied en er wordt geen muur opgesteld. Alle spelers blijven buiten het
      keepersgebied tot de penalty genomen is. Het spel gaat direct verder.
    </li>
  </ul>
</Section>

      <Section title="Keeper">
        <ul className="list-disc ml-6">
          <li>Het team speelt met een vaste of wisselende keeper. Dit dient vooraf aangegeven te worden.</li>
          <li>De keeper mag de bal binnen het keepersgebied met zijn/haar hele lichaam tegenhouden, inclusief handen en voeten. De bal moet zich binnen de cirkel bevinden voordat de keeper deze met de hand mag pakken. De keeper hoeft door voor zelf niet in de cirkel te zijn.</li>
          <li>Komt de keeper uit zijn/haar gebied en raakt hij/zij de bal met handen of voeten, dan volgt een penalty.</li>
          <li>De keeper mag de bal maximaal 6 seconden vasthouden.</li>
          <li>Bij het uitnemen mag de keeper de bal gooien, schoppen of slaan en is niet verplicht de stick te gebruiken. Buiten het keepersgebied mag de keeper de bal alleen met hoofd of romp verplaatsen.</li>
          <li>Wisselen van keeper mag alleen als deze de bal vast heeft.</li>
          <li>De keeper mag niet met zijn/haar stick gooien. (penalty)</li>
          <li>De keeper mag de bal maar 1 keer met de handen vastpakken. De bal moet eerst een andere speler hebben geraakt voor hij/zij de bal weer met de handen mag pakken.</li>
        </ul>
      </Section>

      <Section title="Gebruik van de Stick">
        <ul className="list-disc ml-6">
          <li>Bij het hinderen van een tegenstander mag er met de stick worden gegooid, zolang dit veilig gebeurt. De stick moet richting de grond blijven gericht en mag niet omhoog gaan.</li>
          <li>Als je je stick gooit gelden de vokgende regels:</li>
          <ul className="list-disc ml-6">
          <li>De stick mag alleen de bal raken.</li>
            <li>Totdat de stick is opgehaald, mag hij geen invloed hebben op het spel.</li>
            <li>Een speler zonder stick die een bal op het lichaam krijgt (ook per ongeluk) of de tegenstander hindert, veroorzaakt een penalty.</li>
            </ul>
            <li>Een tegenstander die in balbezit is mag geslagen worden met het tampongedeelte van de stick. Dit mag uitsluitend tegen de rug en schouders. Dit mag alleen dienen voor het hinderen van de tegenstander en nooit voor het pijnigen van deze speler. Zodra de speler de bal niet meer in bezit heeft mag deze ook niet meer geraakt worden met de stick.</li>
        <li>Je mag met je stick de stick van je tegenstander weg tikken (niet slaan) zodat deze de bal niet meer kan spelen.</li>
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
