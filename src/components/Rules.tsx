import React, { useState } from "react";
import BookOpenIcon from "./icons/BookOpenIcon";
import RuleSearch from "./RuleSearch";

// Highlight functie – voegt alleen <mark> toe rond matches
const highlight = (text: string, query: string) => {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query})`, "gi");
  return text.replace(
    regex,
    "<mark class='bg-green-200 text-black'>$1</mark>"
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5 mb-6 shadow-md">
    <h2 className="text-xl font-bold text-green-500 mb-3 flex items-center gap-2">
      <BookOpenIcon className="w-5 h-5" />
      {title}
    </h2>
    <div className="text-gray-300 text-sm leading-relaxed space-y-2">
      {children}
    </div>
  </div>
);

const Line: React.FC<{ text: string; query: string }> = ({ text, query }) => (
  <li dangerouslySetInnerHTML={{ __html: highlight(text, query) }} />
);

const Rules: React.FC = () => {
  const [query, setQuery] = useState("");

  return (
    <div className="max-w-3xl mx-auto px-2 pb-10">
      <h1 className="text-3xl font-extrabold text-white text-center mb-8">
        Bounceball Spelregels
      </h1>

      {/* Zoekbalk */}
      <RuleSearch query={query} onChange={setQuery} />

      <Section title="Doel van het Spel">
        <ul className="list-disc ml-6">
          <Line
            text="Het team dat aan het einde van de wedstrijd de meeste doelpunten heeft, wint."
            query={query}
          />
        </ul>
      </Section>

      <Section title="Sportiviteit & Respect">
        <ul className="list-disc ml-6">
          <Line
            text="We spelen voor ons plezier en vinden sportiviteit en respect voor elkaar heel belangrijk. Onsportief gedrag en blessures moeten zoveel mogelijk worden voorkomen. Iedereen die zich onsportief of agressief gedraagt, wordt hierop aangesproken."
            query={query}
          />
          <Line
            text="Het is de bedoeling dat iedereen in een veilige en prettige sfeer kan spelen, voor, tijdens en na de wedstrijd."
            query={query}
          />
          <Line
            text="Wie herhaaldelijk ongewenst gedrag vertoont, kan worden geschorst of zelfs uit de vereniging worden gezet."
            query={query}
          />
        </ul>
      </Section>

      <Section title="Algemene Spelregels">
        <ul className="list-disc ml-6">
          <Line
            text="Een wedstrijd duurt meestal 50 minuten, maar deze tijd kan worden aangepast als dat duidelijk wordt afgesproken. We spelen meestal 2 wedstrijden op een avond."
            query={query}
          />
          <Line
            text="Zodra de tijd (op de klok van de sporthal) om is, stopt de wedstrijd direct (geen blessuretijd). Als er nog een penalty genomen moet worden, mag dat nog wel. Dit geldt ook voor een eventuele pauze indien er met 4 in een team gespeeld wordt. Die pauze duurt 5 min na 25 min speeltijd."
            query={query}
          />
          <Line
            text="Halverwege de wedstrijd kan er van speelhelft gewisseld worden als één van de teams dat wil. Als beide teams geen behoefte hebben aan het wisselen van helft, hoeft het niet."
            query={query}
          />
          <Line
            text="De grootte van de teams hangt af van de zaal en het aantal spelers. In een zaal van een derde van een zaalvoetbalveld spelen we 4 tegen 4, inclusief keepers, of in teams van 5 met een wissel."
            query={query}
          />
        </ul>
      </Section>

      <Section title="Wisselen">
        <ul className="list-disc ml-6">
          <Line
            text="Als er 5 spelers in een team zijn, wordt er gespeeld met wissels."
            query={query}
          />
          <Line
            text="De volgorde van wisselen staat op het wedstrijdformulier. De eerste wedstrijd wordt er van boven naar beneden gewisseld en de tweede wedstrijd van beneden naar boven."
            query={query}
          />
          <Line
            text="Er dient elke 5 minuten gewisseld te worden. Zodra het tijd is én de keeper heeft de bal vast, wordt er gewisseld."
            query={query}
          />
          <Line
            text="Als de wedstrijd niet in een 5-minutenkader begint, pak je de meest logische wisselstand (bijv. bij 12 min over, wissel je om 15 min over. En bij 13 min over, wissel je om 20 min over)"
            query={query}
          />
          <Line text="Wissels houden de score bij." query={query} />
          <Line
            text="Bij een wisselende keeper wisselt de keeper mee zoals op het wedstrijdformulier is aangegeven. Bij een vaste keeper wisselt de keeper niet."
            query={query}
          />
        </ul>
      </Section>

      <Section title="Speelveld">
        <ul className="list-disc ml-6">
          <Line
            text="We spelen meestal in een zaal van een derde van een zaalvoetbalveld."
            query={query}
          />
          <Line
            text="Er zijn geen lijnen aan de zijkanten of achterkant, dus de bal blijft altijd in het spel. De enige uitzondering is als de bal op of achter het doel komt (dan is het keeperbal)."
            query={query}
          />
          <Line
            text="Komt de bal op de tribune en stuitert hij, zonder bemoeienis van toeschouwers, terug het veld in? Dan gaat het spel gewoon door."
            query={query}
          />
          <Line
            text="Het keepersgebied wordt aangegeven door een halve cirkel rond het doel. Het doel zelf staat met de palen op de achterlijn, die dient als doellijn. Mocht het zijn dat de doelpalen over de doellijn staan, dan is de (denkbeeldige) doellijn tussen de palen."
            query={query}
          />
          <Line
            text="Spelers moeten rekening houden met de muren; contact moet vermeden worden om blessures te voorkomen."
            query={query}
          />
          <Line
            text="In de zaal mag 1 bank staan ten behoeve van de wisselspelers, verder dient de zaal leeg te zijn van banken of andere attributen. Ook geen grote sporttassen op of bij de bank. Dit i.v.m. de veiligheid."
            query={query}
          />
        </ul>
      </Section>

      <Section title="Materiaal">
        <ul className="list-disc ml-6">
          <Line
            text="We spelen Bounceball met een plastic bal, kleiner dan een handbal en groter dan een honkbal."
            query={query}
          />
          <Line
            text="Elke speler gebruikt een tamponstick. Alle sticks moeten dezelfde grootte hebben en niet aangepast zijn. Elk team gebruikt dezelfde kleur sticks."
            query={query}
          />
        </ul>
      </Section>

      <Section title="Spelverloop">
        <ul className="list-disc ml-6">
          <Line
            text="De bal mag alleen verplaatst worden door het zachte gedeelte van de stick. Kopbal of aannemen met de romp is toegestaan."
            query={query}
          />
          <Line
            text="De bal mag zowel over de grond als door de lucht gespeeld worden."
            query={query}
          />
          <Line
            text="De bal mag alleen met de stick worden afgepakt; lichamelijk contact is beperkt tot schouderduwen."
            query={query}
          />
          <Line
            text="Raakt de bal onbedoeld een been, voet, hand of arm? Dan gaat het spel door. Bij opzettelijk gebruik van deze lichaamsdelen volgt een vrije slag."
            query={query}
          />
        </ul>
      </Section>

      <Section title="Verdediging">
        <ul className="list-disc ml-6">
          <Line
            text="Een verdediger mag in de ‘sfinx’-houding een schot blokkeren door op één knie te gaan zitten en zijn stick voor zich te houden."
            query={query}
          />
          <Line
            text="Andere verdedigende bewegingen, zoals voor de bal duiken, zijn niet toegestaan en worden bestraft met een penalty."
            query={query}
          />
        </ul>
      </Section>

      <Section title="Doelpunten">
        <ul className="list-disc ml-6">
          <Line
            text="Een doelpunt is geldig als de bal volledig en op correcte wijze over de doellijn gaat, waarbij de bal als laatste met het tampongedeelte van de stick is geraakt."
            query={query}
          />
          <Line
            text="Een eigen doelpunt telt altijd, ongeacht hoe de bal wordt geraakt."
            query={query}
          />
          <Line
            text="Na een doelpunt brengt de keeper de bal terug in het spel door deze eerst met de hand vast te pakken."
            query={query}
          />
        </ul>
      </Section>

      <Section title="Vrije slag & Penalty">
        <ul className="list-disc ml-6">
          <Line
            text="Een vrije slag wordt gegeven bij een overtreding buiten het keepersgebied."
            query={query}
          />
          <li>
            <span
              dangerouslySetInnerHTML={{
                __html: highlight(
                  "De volgende acties zijn overtredingen:",
                  query
                ),
              }}
            />
            <ul className="list-disc ml-6">
              <Line text="Een tegenstander vasthouden." query={query} />
              <Line
                text="De bal opzettelijk tegenhouden met het been, de voet, de hand of de arm."
                query={query}
              />
              <Line text="Foutief gebruik van de stick." query={query} />
              <Line
                text="Iemand raken met de stick op de benen."
                query={query}
              />
            </ul>
          </li>
          <Line
            text={`Een vrije slag mag direct op doel geschoten worden. Tegenstanders mogen een muur opstellen,
      maar deze moet minstens twee sticks afstand hebben tot de bal.`}
            query={query}
          />
          <Line
            text={`Een penalty dient genomen te worden vanaf de lijn van het keepersgebied en er wordt geen muur opgesteld. Alle spelers blijven buiten het
      keepersgebied tot de penalty genomen is. Het spel gaat direct verder.`}
            query={query}
          />
          <Line
            text="Een penalty wordt genomen door degene die hem verdiend heeft."
            query={query}
          />
        </ul>
      </Section>

      <Section title="Keeper">
        <ul className="list-disc ml-6">
          <Line
            text="Het team speelt met een vaste of wisselende keeper. Dit dient vooraf aangegeven te worden."
            query={query}
          />
          <Line
            text="De keeper mag de bal binnen het keepersgebied met zijn/haar hele lichaam tegenhouden, inclusief handen en voeten. De bal moet zich binnen de cirkel bevinden voordat de keeper deze met de hand mag pakken. De keeper hoeft daarvoor zelf niet in de cirkel te zijn."
            query={query}
          />
          <Line
            text="Komt de keeper uit zijn/haar gebied en raakt hij/zij de bal met handen of voeten, dan volgt een penalty."
            query={query}
          />
          <Line
            text="De keeper mag de bal maximaal 6 seconden vasthouden."
            query={query}
          />
          <Line
            text="Bij het uitnemen mag de keeper de bal gooien, schoppen of slaan en is niet verplicht de stick te gebruiken. Buiten het keepersgebied mag de keeper de bal alleen met hoofd of romp verplaatsen."
            query={query}
          />
          <Line
            text="Wisselen van keeper mag alleen als deze de bal vasthoudt."
            query={query}
          />
          <Line
            text="De keeper mag niet met zijn/haar stick gooien. (penalty)"
            query={query}
          />
          <Line
            text="De keeper mag de bal maar ėėn keer met de handen vastpakken. De bal moet eerst een andere speler hebben geraakt voor hij/zij de bal weer met de handen mag pakken."
            query={query}
          />
        </ul>
      </Section>

      <Section title="Gebruik van de Stick">
        <ul className="list-disc ml-6">
          <Line
            text="Bij het hinderen van een tegenstander mag er met de stick worden gegooid, zolang dit veilig gebeurt. De stick moet richting de grond blijven gericht en mag niet omhoog gaan."
            query={query}
          />
          <li>
            <span
              dangerouslySetInnerHTML={{
                __html: highlight(
                  "Als je je stick gooit, gelden de volgende regels:",
                  query
                ),
              }}
            />
            <ul className="list-disc ml-6">
              <Line
                text="De stick mag alleen de bal raken."
                query={query}
              />
              <Line
                text="Totdat de stick is opgehaald, mag hij geen invloed hebben op het spel."
                query={query}
              />
              <Line
                text="Een speler zonder stick die een bal op het lichaam krijgt (ook per ongeluk) of de tegenstander hindert, veroorzaakt een penalty."
                query={query}
              />
            </ul>
          </li>
          <Line
            text="Een tegenstander die in balbezit is mag geslagen worden met het tampongedeelte van de stick. Dit mag uitsluitend tegen de rug en schouders. Dit mag alleen dienen voor het hinderen van de tegenstander en nooit voor het pijnigen van deze speler. Zodra de speler de bal niet meer in bezit heeft, mag deze ook niet meer geraakt worden met de stick."
            query={query}
          />
          <Line
            text="Je mag met je stick de stick van je tegenstander wegtikken (niet slaan) zodat deze de bal niet meer kan spelen."
            query={query}
          />
        </ul>
      </Section>

      <Section title="Klassement">
        <ul className="list-disc ml-6">
          <Line
            text="Elk teamlid krijgt 3 punten voor een gewonnen wedstrijd, 1 punt voor een gelijkspel en 0 punten bij verlies."
            query={query}
          />
          <Line
            text="Na de eerste wedstrijd spelen de winnende teams tegen elkaar, net als de verliezende teams."
            query={query}
          />
          <Line
            text="Het klassement wordt berekend op basis van het gemiddelde aantal punten per wedstrijd. Spelers moeten minimaal 50% van de wedstrijden hebben gespeeld om mee te tellen voor het klassement."
            query={query}
          />
          <Line
            text="Bij gelijke stand geeft het gemiddelde aantal doelpunten de doorslag."
            query={query}
          />
          <Line
            text="Ook wordt er bijgehouden wie er gemiddeld de meeste doelpunten heeft gescoord en wie er gemiddeld de minste doelpunten heeft tegengekregen."
            query={query}
          />
        </ul>
      </Section>

      <Section title="Aanmelden & Afmelden">
        <ul className="list-disc ml-6">
          <Line
            text="Vaste leden hebben tot vrijdag 18:00 uur voorrang op aanmelden. De niet-vaste leden kunnen zich dan inschrijven als reserve. Na vrijdag 18:00 uur worden de reserves onderaan de lijst toegevoegd."
            query={query}
          />
          <Line
            text="Een introducee die voor de allereerste keer meedoet mag gewoon opgegeven worden, ook voor vrijdag 18:00. Dit om de drempel laag te houden. LET OP: alleen de eerste keer."
            query={query}
          />
          <Line
            text="Aanmelden kan tot zondag 23:59 uur, zo ook afmelden. Hierna kan afmelden alleen met een geldige reden."
            query={query}
          />
          <li>
            <span
              dangerouslySetInnerHTML={{
                __html: highlight(
                  "Het maximaal aantal deelnemers hangt af van het aantal zaaldelen:",
                  query
                ),
              }}
            />
            <ul className="list-disc ml-6">
              <Line text="1 zaal: 8 tot 10 spelers." query={query} />
              <Line text="2 zalen: 16 tot 20 spelers." query={query} />
              <Line text="3 zalen: 24 tot 30 spelers." query={query} />
            </ul>
          </li>
        </ul>
      </Section>

      <p className="text-center text-gray-500 mt-10 text-xs">
        Laatste update: {new Date().toLocaleDateString("nl-NL")}
      </p>
    </div>
  );
};

export default Rules;
