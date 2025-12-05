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

      {/* Doel van het spel */}
      <Section title="Doel van het Spel">
        <ul className="list-disc ml-6">
          <li>Het team dat aan het einde van de wedstrijd de meeste doelpunten heeft, wint.</li>
        </ul>
      </Section>

      {/* Sportiviteit */}
      <Section title="Sportiviteit & Respect">
        <ul className="list-disc ml-6">
          <li>We spelen voor ons plezier en vinden sportiviteit en respect voor elkaar heel belangrijk. Onsportief gedrag en blessures moeten zoveel mogelijk worden voorkomen. Iedereen die zich onsportief of agressief gedraagt, wordt hierop aangesproken.</li>
          <li>Het is de bedoeling dat iedereen in een veilige en prettige sfeer kan spelen: voor, tijdens en na de wedstrijd.</li>
          <li>Wie herhaaldelijk ongewenst gedrag vertoont, kan worden geschorst of uit de vereniging worden gezet.</li>
        </ul>
      </Section>

      {/* Algemene regels */}
      <Section title="Algemene Spelregels">
        <ul className="list-disc ml-6">
          <li>Een wedstrijd duurt meestal 50 minuten, maar deze tijd kan worden aangepast als dat duidelijk wordt afgesproken.</li>
          <li>Zodra de tijd (op de klok van de sporthal) om is, stopt de wedstrijd direct (geen blessuretijd). Penalties die nog genomen moeten worden, gaan wel door.</li>
          <li>Halverwege de wedstrijd kan er van speelhelft worden gewisseld als één van de teams dat wil.</li>
          <li>In een zaal van een derde van een zaalvoetbalveld spelen we 4 tegen 4 (incl. keeper) of 5 met wissels.</li>
        </ul>
      </Section>

      {/* Wissels */}
      <Section title="Wisselen">
        <ul className="list-disc ml-6">
          <li>Bij 5 spelers per team wordt er gespeeld met wissels.</li>
          <li>De eerste wedstrijd wordt er van boven naar beneden gewisseld, de tweede van beneden naar boven.</li>
          <li>Er wordt elke 5 minuten gewisseld zodra de keeper de bal vastheeft.</li>
          <li>Start de wedstrijd niet op een 5-minutenpunt, dan neem je de eerstvolgende logische wisseltijd.</li>
          <li>Wissels houden de score bij.</li>
          <li>Bij een wisselende keeper wisselt de keeper mee; bij een vaste keeper niet.</li>
        </ul>
      </Section>

      {/* Speelveld */}
      <Section title="Speelveld">
        <ul className="list-disc ml-6">
          <li>De wedstrijd vindt meestal plaats in één derde zaalvoetbalveld.</li>
          <li>Er zijn geen zijlijnen; de bal blijft altijd in het spel behalve wanneer deze op of achter het doel komt.</li>
          <li>Stuitert de bal via de tribune terug het veld in zonder toeschouwercontact? Dan gaat het spel door.</li>
          <li>Het keepersgebied is een halve cirkel rond het doel. De denkbeeldige lijn tussen de palen is de doellijn.</li>
          <li>Contact met muren moet worden vermeden.</li>
          <li>Er mag één bank voor wissels staan; overige objecten moeten uit de zaal voor veiligheid.</li>
        </ul>
      </Section>

      {/* Materiaal */}
      <Section title="Materiaal">
        <ul className="list-disc ml-6">
          <li>We spelen met een plastic bal, kleiner dan een handbal.</li>
          <li>Iedere speler gebruikt een tamponstick. Alle sticks binnen een team hebben dezelfde lengte en kleur.</li>
        </ul>
      </Section>

      {/* Spelverloop */}
      <Section title="Spelverloop">
        <ul className="list-disc ml-6">
          <li>De bal mag alleen gespeeld worden met het zachte gedeelte van de stick. Kopballen en aannemen met de romp zijn toegestaan.</li>
          <li>De bal mag over de grond en door de lucht gespeeld worden.</li>
          <li>Lichamelijk contact is beperkt tot schouderduwen.</li>
          <li>Raakt de bal een been, voet, hand of arm per ongeluk? Dan gaat het spel door. Opzettelijk gebruik = vrijeslag.</li>
        </ul>
      </Section>

      {/* Verdediging */}
      <Section title="Verdediging">
        <ul className="list-disc ml-6">
          <li>Een verdediger mag in ‘sfinx’-houding een schot blokkeren.</li>
          <li>Duiken of voor de bal springen is niet toegestaan en leidt tot een penalty.</li>
        </ul>
      </Section>

      {/* Doelpunten */}
      <Section title="Doelpunten">
        <ul className="list-disc ml-6">
          <li>Een doelpunt telt wanneer de bal volledig en correct over de doellijn gaat en als laatste met het tampongedeelte is geraakt.</li>
          <li>Eigen doelpunten tellen altijd.</li>
          <li>Na een doelpunt brengt de keeper de bal in door hem eerst met de hand vast te pakken.</li>
        </ul>
      </Section>

      {/* Vrijeslag & Penalty */}
      <Section title="Vrijeslag & Penalty">
        <ul className="list-disc ml-6">
          <li>Een vrijeslag wordt gegeven bij overtredingen buiten het keepersgebied.</li>

          <li>
            De volgende acties zijn overtredingen:
            <ul className="list-disc ml-6 mt-1">
              <li>Een tegenstander vasthouden.</li>
              <li>De bal opzettelijk tegenhouden met been, voet, hand of arm.</li>
              <li>Foutief gebruik van de stick.</li>
              <li>Iemand raken met de stick op de benen.</li>
            </ul>
          </li>

          <li>Een vrijeslag mag direct op doel worden geschoten. De muur staat op minimaal twee sticks afstand.</li>

          <li>
            Een penalty volgt bij een overtreding in het keepersgebied. De bal staat op de rand van het gebied; er is geen muur.
            Alle spelers blijven buiten het gebied tot de penalty is genomen.
          </li>
          <li>Een penalty wordt genomen door degene die hem verdiend heeft.</li>
        </ul>
      </Section>

      {/* Keeper */}
      <Section title="Keeper">
        <ul className="list-disc ml-6">
          <li>Het team speelt met een vaste of wisselende keeper. Dit wordt vooraf bepaald.</li>
          <li>De keeper mag binnen het gebied met het hele lichaam verdedigen. De bal moet in het gebied liggen om hem met de hand vast te pakken.</li>
          <li>Hand- of voetcontact buiten het gebied = penalty.</li>
          <li>De keeper mag de bal maximaal 6 seconden vasthouden.</li>
          <li>Bij het uitnemen mag de keeper gooien, schoppen of slaan.</li>
          <li>Keeper wisselen mag alleen wanneer deze de bal vastheeft.</li>
          <li>De keeper mag niet met de stick gooien.</li>
          <li>De keeper mag de bal maar één keer met de handen vastpakken totdat een andere speler hem heeft geraakt.</li>
        </ul>
      </Section>

      {/* Gebruik van de stick */}
      <Section title="Gebruik van de Stick">
        <ul className="list-disc ml-6">
          <li>Je mag je stick gooien om te hinderen, zolang dit veilig gebeurt en richting de grond.</li>

          <li>
            Als je je stick gooit, gelden de volgende regels:
            <ul className="list-disc ml-6 mt-1">
              <li>De stick mag alleen de bal raken.</li>
              <li>Totdat de stick is opgepakt, mag hij geen invloed hebben op het spel.</li>
              <li>Een speler zonder stick die de bal op het lichaam krijgt of hindert, veroorzaakt een penalty.</li>
            </ul>
          </li>

          <li>Een tegenstander in balbezit mag met het tampongedeelte op rug en schouders worden gehinderd, maar nooit pijn gedaan.</li>
          <li>Een tegenstander die de bal niet meer heeft, mag niet meer worden geraakt met de stick.</li>
          <li>Je mag de stick van een tegenstander weg tikken (niet slaan) om hem te hinderen.</li>
        </ul>
      </Section>

      {/* Klassement */}
      <Section title="Klassement">
        <ul className="list-disc ml-6">
          <li>3 punten voor winst, 1 voor gelijkspel, 0 voor verlies.</li>
          <li>Na de eerste wedstrijd spelen winnaars tegen winnaars en verliezers tegen verliezers.</li>
          <li>Het klassement wordt berekend op basis van gemiddelde punten per wedstrijd. Minimaal 50% deelname vereist.</li>
          <li>Bij gelijke stand geeft het gemiddelde aantal doelpunten de doorslag.</li>
          <li>Er wordt bijgehouden wie gemiddeld de meeste doelpunten scoort en wie gemiddeld de minste doelpunten tegen krijgt.</li>
        </ul>
      </Section>

      {/* Aanmelden */}
      <Section title="Aanmelden & Afmelden">
        <ul className="list-disc ml-6">
          <li>Vaste leden hebben tot vrijdag 18:00 uur voorrang op aanmelden.</li>
          <li>Een introducee mag de eerste keer zonder beperkingen meedoen.</li>
          <li>Aan- en afmelden kan tot zondag 23:59 uur. Daarna alleen met geldige reden.</li>
          <li>Maximaal aantal deelnemers hangt af van de zaalindeling:
            <ul className="list-disc ml-6">
              <li>1 zaal: 8–10 spelers</li>
              <li>2 zalen: 16–20 spelers</li>
              <li>3 zalen: 24–30 spelers</li>
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
