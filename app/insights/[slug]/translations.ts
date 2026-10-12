import type { Locale } from "../../lib/i18n";

type Article = { title: string; paragraphs: string[] };

export const articleTranslations: Record<Exclude<Locale, "en">, Record<string, Article>> = {
  de: {
    "how-fractional-real-estate-participation-works": {
      title: "So funktioniert die anteilige Immobilienbeteiligung",
      paragraphs: [
        "Eine anteilige Immobilienbeteiligung ermöglicht es Anlegern, eine Immobilie zu prüfen, ohne das gesamte Objekt zu kaufen. Das Modell basiert auf einem festgelegten Immobilienwert, der erwarteten Miete, dem Beteiligungsbetrag und der Auszahlungsstruktur.",
        "Bei Brickwise zeigt die Projektseite die modellierte Bruttomietzuordnung für unterschiedliche Beteiligungsbeträge. So lassen sich Immobilien leichter vergleichen, bevor eine Anfrage gestellt wird.",
        "Entscheidend ist eine sorgfältige Prüfung: Das Modell ist nur dann hilfreich, wenn Anleger auch Leerstandsrisiken, Kosten, Steuern, Liquidität und Marktbedingungen berücksichtigen.",
      ],
    },
    "what-to-review-before-comparing-rental-yield": {
      title: "Was Sie vor dem Vergleich von Mietrenditen prüfen sollten",
      paragraphs: [
        "Die Bruttorendite ist nur ein Teil einer Immobilienentscheidung. Anleger sollten den Immobilienwert mit der erwarteten Miete vergleichen und anschließend prüfen, welche Kosten oder Leerstände das Ergebnis mindern könnten.",
        "Kanadische Immobilienmärkte sind lokal geprägt. Eine Eigentumswohnung in Toronto, ein Apartment in Calgary und ein Dreifamilienhaus in Montreal können sich hinsichtlich Erschwinglichkeit, Mieten, Steuern und Instandhaltung stark unterscheiden.",
        "Eine klare Prüfung beginnt mit einfachen Fragen: Wo befindet sich die Immobilie, wer kommt als Mieter infrage, welche Einnahmen werden angenommen und was könnte schiefgehen?",
      ],
    },
    "why-transparency-matters-in-canadian-property-access": {
      title: "Warum Transparenz beim Zugang zu kanadischen Immobilien wichtig ist",
      paragraphs: [
        "Transparenz ist wichtig, weil Immobilienentscheidungen Erträge, Risiken, Liquidität und Zeitpunkt miteinander verbinden. Anleger benötigen klare Annahmen, bevor sie Chancen vergleichen können.",
        "Eine hilfreiche Immobilienseite sollte Wert, Miete, Bruttorendite, Beteiligungsbetrag, Auszahlungsmodell und die wichtigsten Risikohinweise an einem Ort zeigen.",
        "Brickwise baut auf dieser Idee auf: weniger vage Aussagen, mehr strukturierte Informationen und ein klarerer Weg vom ersten Interesse zur Prüfung.",
      ],
    },
  },
  fr: {
    "how-fractional-real-estate-participation-works": {
      title: "Comment fonctionne la participation immobilière fractionnée",
      paragraphs: [
        "La participation immobilière fractionnée permet aux investisseurs d'examiner un bien sans acheter l'ensemble de l'actif. Le modèle repose sur une valeur immobilière définie, un loyer attendu, un montant de participation et une structure de versement.",
        "Sur Brickwise, la page du projet présente la répartition modélisée du loyer brut pour différents montants de participation. Cela facilite la comparaison des biens avant l'envoi d'une demande.",
        "L'essentiel est la rigueur : le modèle n'est utile que si les investisseurs examinent aussi le risque de vacance, les coûts, les impôts, la liquidité et les conditions du marché.",
      ],
    },
    "what-to-review-before-comparing-rental-yield": {
      title: "Que vérifier avant de comparer les rendements locatifs",
      paragraphs: [
        "Le rendement brut n'est qu'un élément d'une décision immobilière. Les investisseurs devraient comparer la valeur du bien au loyer attendu, puis déterminer quels coûts ou périodes de vacance pourraient réduire le résultat.",
        "Les marchés canadiens sont locaux. Un appartement en copropriété à Toronto, un appartement à Calgary et un triplex à Montréal peuvent présenter des dynamiques très différentes en matière d'accessibilité financière, de loyers, de fiscalité et d'entretien.",
        "Un examen clair commence par des questions simples : où se trouve le bien, qui est susceptible de le louer, quels revenus sont supposés et qu'est-ce qui pourrait mal se passer ?",
      ],
    },
    "why-transparency-matters-in-canadian-property-access": {
      title: "Pourquoi la transparence est importante pour accéder à l'immobilier canadien",
      paragraphs: [
        "La transparence est importante, car les décisions immobilières associent revenus, risques, liquidité et calendrier. Les investisseurs ont besoin d'hypothèses claires pour comparer les opportunités.",
        "Une page immobilière utile devrait regrouper la valeur, le loyer, le rendement brut, le montant de participation, le modèle de versement et les principales informations sur les risques.",
        "Brickwise repose sur cette idée : moins d'affirmations vagues, davantage d'informations structurées et un parcours plus clair entre l'intérêt initial et l'examen du projet.",
      ],
    },
  },
  es: {
    "how-fractional-real-estate-participation-works": {
      title: "Cómo funciona la participación inmobiliaria fraccionada",
      paragraphs: [
        "La participación inmobiliaria fraccionada permite a los inversores analizar una propiedad sin comprar el activo completo. El modelo se basa en un valor inmobiliario definido, el alquiler previsto, el importe de participación y la estructura de pagos.",
        "En Brickwise, la página del proyecto muestra la distribución modelada del alquiler bruto para distintos importes de participación. Esto facilita la comparación de propiedades antes de enviar una solicitud.",
        "Lo esencial es la disciplina: el modelo solo resulta útil si los inversores también revisan el riesgo de desocupación, los costes, los impuestos, la liquidez y las condiciones del mercado.",
      ],
    },
    "what-to-review-before-comparing-rental-yield": {
      title: "Qué revisar antes de comparar la rentabilidad del alquiler",
      paragraphs: [
        "La rentabilidad bruta es solo una parte de una decisión inmobiliaria. Los inversores deberían comparar el valor del inmueble con el alquiler previsto y después analizar qué costes o periodos de desocupación podrían reducir el resultado.",
        "Los mercados canadienses son locales. Un apartamento en condominio en Toronto, un piso en Calgary y un edificio de tres viviendas en Montreal pueden presentar dinámicas muy distintas de asequibilidad, alquileres, impuestos y mantenimiento.",
        "Una revisión clara empieza con preguntas sencillas: ¿dónde está el inmueble, quién podría alquilarlo, qué ingresos se presuponen y qué podría salir mal?",
      ],
    },
    "why-transparency-matters-in-canadian-property-access": {
      title: "Por qué importa la transparencia al acceder al mercado inmobiliario canadiense",
      paragraphs: [
        "La transparencia es importante porque las decisiones inmobiliarias combinan ingresos, riesgos, liquidez y plazos. Los inversores necesitan hipótesis claras para comparar oportunidades.",
        "Una página inmobiliaria útil debería mostrar en un solo lugar el valor, el alquiler, la rentabilidad bruta, el importe de participación, el modelo de pagos y las principales advertencias sobre riesgos.",
        "Brickwise se basa en esa idea: menos afirmaciones vagas, más información estructurada y un camino más claro desde el interés inicial hasta la revisión.",
      ],
    },
  },
  it: {
    "how-fractional-real-estate-participation-works": {
      title: "Come funziona la partecipazione immobiliare frazionata",
      paragraphs: [
        "La partecipazione immobiliare frazionata consente agli investitori di esaminare un immobile senza acquistare l'intero bene. Il modello si basa su un valore immobiliare definito, il canone atteso, l'importo di partecipazione e la struttura dei versamenti.",
        "Su Brickwise, la pagina del progetto mostra la ripartizione modellata del canone lordo per diversi importi di partecipazione. Questo facilita il confronto tra immobili prima di inviare una richiesta.",
        "L'aspetto essenziale è la disciplina: il modello è utile solo se gli investitori valutano anche il rischio di sfitto, i costi, le imposte, la liquidità e le condizioni di mercato.",
      ],
    },
    "what-to-review-before-comparing-rental-yield": {
      title: "Cosa esaminare prima di confrontare i rendimenti da locazione",
      paragraphs: [
        "Il rendimento lordo è solo una parte di una decisione immobiliare. Gli investitori dovrebbero confrontare il valore dell'immobile con il canone atteso e poi valutare quali costi o periodi di sfitto potrebbero ridurre il risultato.",
        "I mercati canadesi sono locali. Un appartamento in condominio a Toronto, un appartamento a Calgary e un edificio di tre abitazioni a Montreal possono presentare dinamiche molto diverse in termini di accessibilità economica, canoni, imposte e manutenzione.",
        "Un esame chiaro inizia da domande semplici: dove si trova l'immobile, chi potrebbe affittarlo, quali redditi si ipotizzano e cosa potrebbe andare storto?",
      ],
    },
    "why-transparency-matters-in-canadian-property-access": {
      title: "Perché la trasparenza è importante nell'accesso agli immobili canadesi",
      paragraphs: [
        "La trasparenza è importante perché le decisioni immobiliari combinano reddito, rischio, liquidità e tempistiche. Gli investitori hanno bisogno di ipotesi chiare per confrontare le opportunità.",
        "Una pagina immobiliare utile dovrebbe riunire valore, canone, rendimento lordo, importo di partecipazione, modello di versamento e principali avvertenze sui rischi.",
        "Brickwise si basa su questa idea: meno affermazioni vaghe, più informazioni strutturate e un percorso più chiaro dall'interesse iniziale alla valutazione.",
      ],
    },
  },
};
