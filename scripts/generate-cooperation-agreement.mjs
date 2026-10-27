// Generates the short client cooperation agreement (5 languages) as versioned PDFs
// and writes app/lib/agreement-manifest.json. Archived versions are immutable:
// an existing version folder is verified, never regenerated.
// Usage: node scripts/generate-cooperation-agreement.mjs [path-to-chrome]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const version = "cooperation-2026-10-24-v3";
const root = process.cwd();
const chrome = process.argv[2] || process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const folder = path.join(root, "public", "documents", "agreements", version);
const seal = pathToFileURL(path.join(root, "public", "brand", "brickwise-digital-corporate-seal.svg")).href;

const documents = {
  en: {
    title: "Client Cooperation Agreement",
    draft: "DRAFT — SUBJECT TO LEGAL REVIEW",
    note: "This draft must be reviewed by legal counsel before final use. Text in [square brackets] is completed by the Company.",
    meta: `Document version: ${version} · Agreement reference: assigned on signature`,
    page: ["Page", "of"],
    parties: [
      ["Company", "[COMPANY LEGAL NAME AND LEGAL FORM], registration number [REGISTRATION NUMBER], registered office [REGISTERED ADDRESS], represented by [AUTHORISED REPRESENTATIVE], trading as “Brickwise – Fractional Real Estate” (the “Company”). Business address: 370 NE 75th Street, Unit 126, Miami, Florida 33138, USA. European contact office: Bobinethöfe 38, 54294 Trier, Germany."],
      ["Client", "The client identified on the electronic signature page of this document, holding a verified Brickwise client account (the “Client”). The Company and the Client are each a “Party”."],
    ],
    sections: [
      ["1. Parties"],
      ["2. Purpose and scope",
        "2.1 This Agreement sets out the general terms under which the Client uses the Brickwise client portal to review real-estate projects, request fractional participations (“shares”), fund approved transactions and receive reports and distributions.",
        "2.2 This Agreement is a framework agreement. It does not by itself create a participation, transfer ownership or oblige either Party to complete a transaction. Each participation is governed by a property-specific participation addendum (the “Addendum”) stating the property, the holding structure, the price per share, the rights attached, fees, term and exit conditions. In the event of a conflict, the Addendum prevails for that transaction.",
        "2.3 Prices, yields, calculations, availability and statuses shown in the portal are for information only. They are not an offer, a guarantee or investment advice."],
      ["3. Client account and verification",
        "3.1 The Client provides complete and accurate information, keeps login credentials confidential and informs the Company without delay of any change or suspected misuse of the account.",
        "3.2 Before approving a transaction, the Company may verify the Client’s identity, address, tax residence, beneficial ownership and source of funds. The Company may decline or suspend a transaction and report it to the authorities where required by anti-money-laundering or sanctions law."],
      ["4. Participation process",
        "4.1 The Client submits a request in the portal stating the property, the number of shares and the payment method. A request is non-binding until the Company confirms it in writing and both Parties have signed the Addendum.",
        "4.2 Shares are allocated only after cleared funds, complete documentation and compliance approval. Shares shown as available may be reserved or withdrawn until allocation. If a request cannot be completed, unallocated funds are refunded, less only charges disclosed in advance."],
      ["5. Payments and client wallet",
        "5.1 Payments are made only to the bank accounts or digital-asset addresses shown as verified in the client portal, using the stated payment reference. The Company will never ask for passwords, private keys or recovery phrases.",
        "5.2 Deposits are credited to the Client’s wallet in the portal after the Company has confirmed receipt. For digital assets, the Client is responsible for selecting the correct asset and network; transfers to a wrong address or network may be irrecoverable. The amount credited is the euro amount confirmed by the Company after any conversion.",
        "5.3 All amounts are stated in euro (EUR) unless the Addendum provides otherwise."],
      ["6. Rental income and projections",
        "6.1 The Client participates in the net rental income of a property in proportion to the shares held, as defined in the Addendum. Net rental income is the rent actually collected less operating, management, maintenance, insurance, tax and financing costs, reserves and disclosed fees.",
        "6.2 Target returns and daily, monthly or annual amounts shown in the portal are projections based on assumptions. They are not guaranteed; actual income may be lower, delayed or zero. Distributions are made at the intervals stated in the Addendum."],
      ["7. Fees",
        "The Company charges only the fees set out in its fee schedule and in the Addendum: [FEE SCHEDULE — e.g. entry fee, annual management fee, exit fee — TO BE COMPLETED]. Any other fee requires the Client’s prior agreement in the Addendum."],
      ["8. Holding period, transfer and exit",
        "8.1 Participations are long-term and may be difficult to sell. [EXIT RULES — minimum holding period, notice period, resale or buy-back procedure and pricing — TO BE COMPLETED].",
        "8.2 A transfer or exit is possible only as permitted by the Addendum and applicable law. The Company does not guarantee a buyer, a resale price or an exit date."],
      ["9. Risk notice",
        "Real-estate participations involve risks, including partial or total loss of the capital invested, vacancy, tenant default, damage, falling property values, changes in interest rates, currencies, taxes and regulation, and limited liquidity. Past performance and projections are not reliable indicators of future results. The Client should invest only money that can be committed for the long term and is advised to obtain independent legal, tax and financial advice."],
      ["10. Company obligations and liability",
        "10.1 The Company administers the portal and the participation process with due care, keeps records of all transactions, provides regular reports and discloses the material fees and risks known to it.",
        "10.2 The Company is liable without limitation for intent, gross negligence and injury to life, body or health. Otherwise, to the extent permitted by law, liability is limited to foreseeable damage typical for this type of agreement. Mandatory consumer rights are not affected."],
      ["11. Data protection and communication",
        "The Company processes the Client’s personal data to perform this Agreement and to comply with legal obligations, as described in the Privacy Policy at www.brickwise-immo.de/privacy. Notices are given through the client portal or to the Client’s verified email address. The Client agrees to receive documents electronically."],
      ["12. Term and termination",
        "This Agreement takes effect when the Client signs it and runs for an indefinite period. Either Party may terminate it in text form with [30] days’ notice. The Company may suspend the account with immediate effect for good cause, such as suspected fraud, sanctions or a material breach. Termination does not affect existing participations, which continue under their Addendum."],
      ["13. Right of withdrawal",
        "If the Client is a consumer, the statutory right of withdrawal applies. [WITHDRAWAL INFORMATION — TO BE COMPLETED BY LEGAL COUNSEL]."],
      ["14. Governing law and disputes",
        "This Agreement is governed by [GOVERNING LAW — TO BE CONFIRMED BY LEGAL COUNSEL]. Consumers retain the protection of the mandatory law of their country of habitual residence. Place of jurisdiction: [PLACE OF JURISDICTION], unless mandatory law provides otherwise. The Parties will first try to settle any dispute amicably."],
      ["15. Final provisions",
        "Amendments to this Agreement are notified through the portal at least [30] days before they take effect. Should any provision be invalid, the remaining provisions remain in force. This Agreement is available in English, German, French, Spanish and Italian; the Client signs the language version selected in the portal."],
      ["16. Electronic signature",
        "16.1 The Client signs this Agreement electronically in the client portal by drawing a signature and confirming consent. The Company records the signer’s name, verified email address, date and time (UTC), IP address, device information and the SHA-256 checksum of this document, and attaches them on the electronic signature page.",
        "16.2 The signed PDF is stored in the Client’s account and can be downloaded at any time. The Company confirms the Agreement by reviewing the signature in its administration system [and by the countersignature of its authorised representative]."],
    ],
    signatures: { heading: "Signatures", company: "For the Company", representative: "[AUTHORISED REPRESENTATIVE — NAME, TITLE]", line: "Signature / seal", client: "Client", clientText: "Signed electronically in the Brickwise client portal — see the electronic signature page attached to this document." },
    consent: "I have read the Client Cooperation Agreement in full. By drawing my signature and clicking “Sign agreement”, I accept its terms and sign it electronically with the name shown. A signed PDF copy will be stored in my client account.",
  },
  de: {
    title: "Kundenkooperationsvertrag",
    draft: "ENTWURF — RECHTLICHE PRÜFUNG ERFORDERLICH",
    note: "Dieser Entwurf muss vor der endgültigen Verwendung rechtlich geprüft werden. Text in [eckigen Klammern] wird von der Gesellschaft ergänzt.",
    meta: `Dokumentversion: ${version} · Vertragsreferenz: wird bei der Unterzeichnung vergeben`,
    page: ["Seite", "von"],
    parties: [
      ["Gesellschaft", "[RECHTLICHER FIRMENNAME UND RECHTSFORM], Registernummer [REGISTERNUMMER], Sitz [EINGETRAGENE ANSCHRIFT], vertreten durch [VERTRETUNGSBERECHTIGTE PERSON], handelnd unter der Marke „Brickwise – Fractional Real Estate“ (die „Gesellschaft“). Geschäftsanschrift: 370 NE 75th Street, Unit 126, Miami, Florida 33138, USA. Europäisches Kontaktbüro: Bobinethöfe 38, 54294 Trier, Deutschland."],
      ["Kunde", "Der auf der elektronischen Signaturseite dieses Dokuments bezeichnete Kunde mit einem verifizierten Brickwise-Kundenkonto (der „Kunde“). Gesellschaft und Kunde sind jeweils eine „Partei“."],
    ],
    sections: [
      ["1. Vertragsparteien"],
      ["2. Zweck und Umfang",
        "2.1 Dieser Vertrag regelt die allgemeinen Bedingungen, zu denen der Kunde das Brickwise-Kundenportal nutzt, um Immobilienprojekte zu prüfen, Bruchteilsbeteiligungen („Anteile“) anzufragen, genehmigte Transaktionen zu finanzieren sowie Berichte und Ausschüttungen zu erhalten.",
        "2.2 Dieser Vertrag ist ein Rahmenvertrag. Er begründet für sich allein keine Beteiligung, überträgt kein Eigentum und verpflichtet keine Partei zum Abschluss einer Transaktion. Jede Beteiligung richtet sich nach einem objektbezogenen Beteiligungsnachtrag (der „Nachtrag“), der Immobilie, Haltestruktur, Preis je Anteil, die verbundenen Rechte, Gebühren, Laufzeit und Ausstiegsbedingungen festlegt. Bei Widersprüchen geht der Nachtrag für die jeweilige Transaktion vor.",
        "2.3 Im Portal angezeigte Preise, Renditen, Berechnungen, Verfügbarkeiten und Status dienen nur der Information. Sie sind weder ein Angebot noch eine Garantie oder Anlageberatung."],
      ["3. Kundenkonto und Prüfung",
        "3.1 Der Kunde macht vollständige und richtige Angaben, hält seine Zugangsdaten geheim und informiert die Gesellschaft unverzüglich über Änderungen oder einen Verdacht auf Missbrauch des Kontos.",
        "3.2 Vor der Genehmigung einer Transaktion kann die Gesellschaft Identität, Anschrift, steuerliche Ansässigkeit, wirtschaftliche Berechtigung und Mittelherkunft des Kunden prüfen. Soweit Geldwäsche- oder Sanktionsrecht es verlangt, kann sie eine Transaktion ablehnen oder aussetzen und den Behörden melden."],
      ["4. Ablauf einer Beteiligung",
        "4.1 Der Kunde stellt im Portal eine Anfrage mit Immobilie, Anzahl der Anteile und Zahlungsweg. Eine Anfrage ist unverbindlich, bis die Gesellschaft sie in Textform bestätigt und beide Parteien den Nachtrag unterzeichnet haben.",
        "4.2 Anteile werden erst nach Eingang der Mittel, vollständiger Dokumentation und Compliance-Freigabe zugeteilt. Als verfügbar angezeigte Anteile können bis zur Zuteilung reserviert oder zurückgezogen werden. Kann eine Anfrage nicht ausgeführt werden, werden nicht zugeteilte Mittel abzüglich ausschließlich vorab offengelegter Kosten erstattet."],
      ["5. Zahlungen und Kunden-Wallet",
        "5.1 Zahlungen erfolgen ausschließlich auf die im Kundenportal als verifiziert angezeigten Bankkonten oder Kryptoadressen unter Angabe der genannten Zahlungsreferenz. Die Gesellschaft fragt niemals nach Passwörtern, privaten Schlüsseln oder Wiederherstellungsphrasen.",
        "5.2 Einzahlungen werden dem Wallet des Kunden im Portal gutgeschrieben, nachdem die Gesellschaft den Eingang bestätigt hat. Bei digitalen Vermögenswerten ist der Kunde für die Wahl des richtigen Assets und Netzwerks verantwortlich; Überweisungen an eine falsche Adresse oder in ein falsches Netzwerk können unwiederbringlich verloren gehen. Gutgeschrieben wird der von der Gesellschaft nach etwaiger Umrechnung bestätigte Euro-Betrag.",
        "5.3 Alle Beträge lauten auf Euro (EUR), sofern der Nachtrag nichts anderes bestimmt."],
      ["6. Mieteinnahmen und Prognosen",
        "6.1 Der Kunde ist im Verhältnis seiner Anteile an den Nettomieteinnahmen einer Immobilie beteiligt, wie im Nachtrag festgelegt. Nettomieteinnahmen sind die tatsächlich vereinnahmten Mieten abzüglich Betriebs-, Verwaltungs-, Instandhaltungs-, Versicherungs-, Steuer- und Finanzierungskosten, Rücklagen und offengelegter Gebühren.",
        "6.2 Im Portal angezeigte Zielrenditen sowie tägliche, monatliche oder jährliche Beträge sind Prognosen auf Grundlage von Annahmen. Sie sind nicht garantiert; die tatsächlichen Einnahmen können niedriger ausfallen, sich verzögern oder ausbleiben. Ausschüttungen erfolgen in den im Nachtrag genannten Abständen."],
      ["7. Gebühren",
        "Die Gesellschaft erhebt ausschließlich die in ihrem Gebührenverzeichnis und im Nachtrag genannten Gebühren: [GEBÜHRENVERZEICHNIS — z. B. Einstiegsgebühr, jährliche Verwaltungsgebühr, Ausstiegsgebühr — NOCH ZU ERGÄNZEN]. Jede weitere Gebühr bedarf der vorherigen Zustimmung des Kunden im Nachtrag."],
      ["8. Haltedauer, Übertragung und Ausstieg",
        "8.1 Beteiligungen sind langfristig angelegt und können schwer veräußerbar sein. [AUSSTIEGSREGELN — Mindesthaltedauer, Kündigungsfrist, Verfahren und Preisbildung für Weiterverkauf oder Rückkauf — NOCH ZU ERGÄNZEN].",
        "8.2 Eine Übertragung oder ein Ausstieg ist nur möglich, soweit Nachtrag und geltendes Recht dies zulassen. Die Gesellschaft garantiert weder einen Käufer noch einen Wiederverkaufspreis oder einen Ausstiegszeitpunkt."],
      ["9. Risikohinweis",
        "Immobilienbeteiligungen sind mit Risiken verbunden, darunter der teilweise oder vollständige Verlust des eingesetzten Kapitals, Leerstand, Mietausfall, Schäden, sinkende Immobilienwerte, Änderungen von Zinsen, Wechselkursen, Steuern und Regulierung sowie eingeschränkte Liquidität. Frühere Ergebnisse und Prognosen sind kein verlässlicher Indikator für künftige Ergebnisse. Der Kunde sollte nur Mittel einsetzen, die er langfristig binden kann, und unabhängigen rechtlichen, steuerlichen und finanziellen Rat einholen."],
      ["10. Pflichten und Haftung der Gesellschaft",
        "10.1 Die Gesellschaft betreibt das Portal und den Beteiligungsprozess mit der gebotenen Sorgfalt, dokumentiert alle Transaktionen, erstellt regelmäßige Berichte und legt die ihr bekannten wesentlichen Gebühren und Risiken offen.",
        "10.2 Die Gesellschaft haftet unbeschränkt für Vorsatz, grobe Fahrlässigkeit sowie für Schäden aus der Verletzung von Leben, Körper oder Gesundheit. Im Übrigen ist die Haftung, soweit gesetzlich zulässig, auf den vorhersehbaren, vertragstypischen Schaden begrenzt. Zwingende Verbraucherrechte bleiben unberührt."],
      ["11. Datenschutz und Kommunikation",
        "Die Gesellschaft verarbeitet personenbezogene Daten des Kunden zur Durchführung dieses Vertrags und zur Erfüllung gesetzlicher Pflichten, wie in der Datenschutzerklärung unter www.brickwise-immo.de/privacy beschrieben. Mitteilungen erfolgen über das Kundenportal oder an die verifizierte E-Mail-Adresse des Kunden. Der Kunde ist mit dem elektronischen Empfang von Dokumenten einverstanden."],
      ["12. Laufzeit und Kündigung",
        "Dieser Vertrag wird mit der Unterzeichnung durch den Kunden wirksam und läuft auf unbestimmte Zeit. Jede Partei kann ihn in Textform mit einer Frist von [30] Tagen kündigen. Die Gesellschaft kann das Konto aus wichtigem Grund, etwa bei Betrugsverdacht, Sanktionen oder einer wesentlichen Vertragsverletzung, mit sofortiger Wirkung sperren. Eine Kündigung berührt bestehende Beteiligungen nicht; diese laufen nach ihrem Nachtrag weiter."],
      ["13. Widerrufsrecht",
        "Ist der Kunde Verbraucher, gilt das gesetzliche Widerrufsrecht. [WIDERRUFSBELEHRUNG — VON DER RECHTSBERATUNG ZU ERGÄNZEN]."],
      ["14. Anwendbares Recht und Streitigkeiten",
        "Dieser Vertrag unterliegt [ANWENDBARES RECHT — VON DER RECHTSBERATUNG ZU BESTÄTIGEN]. Verbrauchern bleibt der Schutz der zwingenden Vorschriften des Staates ihres gewöhnlichen Aufenthalts erhalten. Gerichtsstand ist [GERICHTSSTAND], soweit zwingendes Recht nichts anderes bestimmt. Die Parteien bemühen sich zunächst um eine gütliche Einigung."],
      ["15. Schlussbestimmungen",
        "Änderungen dieses Vertrags werden mindestens [30] Tage vor ihrem Inkrafttreten über das Portal mitgeteilt. Sollte eine Bestimmung unwirksam sein, bleiben die übrigen Bestimmungen wirksam. Dieser Vertrag liegt in Englisch, Deutsch, Französisch, Spanisch und Italienisch vor; der Kunde unterzeichnet die im Portal gewählte Sprachfassung."],
      ["16. Elektronische Unterschrift",
        "16.1 Der Kunde unterzeichnet diesen Vertrag elektronisch im Kundenportal, indem er eine Unterschrift zeichnet und seine Zustimmung bestätigt. Die Gesellschaft speichert Namen und verifizierte E-Mail-Adresse des Unterzeichners, Datum und Uhrzeit (UTC), IP-Adresse, Geräteinformationen sowie die SHA-256-Prüfsumme dieses Dokuments und fügt sie auf der elektronischen Signaturseite bei.",
        "16.2 Das unterzeichnete PDF wird im Konto des Kunden gespeichert und kann jederzeit heruntergeladen werden. Die Gesellschaft bestätigt den Vertrag durch die Prüfung der Unterschrift in ihrem Verwaltungssystem [und durch die Gegenzeichnung ihrer vertretungsberechtigten Person]."],
    ],
    signatures: { heading: "Unterschriften", company: "Für die Gesellschaft", representative: "[VERTRETUNGSBERECHTIGTE PERSON — NAME, FUNKTION]", line: "Unterschrift / Siegel", client: "Kunde", clientText: "Elektronisch im Brickwise-Kundenportal unterzeichnet — siehe die diesem Dokument beigefügte elektronische Signaturseite." },
    consent: "Ich habe den Kundenkooperationsvertrag vollständig gelesen. Indem ich meine Unterschrift zeichne und auf „Vertrag unterschreiben“ klicke, akzeptiere ich seine Bedingungen und unterzeichne ihn elektronisch mit dem angezeigten Namen. Eine unterzeichnete PDF-Kopie wird in meinem Kundenkonto gespeichert.",
  },
  fr: {
    title: "Contrat de coopération client",
    draft: "PROJET — EXAMEN JURIDIQUE REQUIS",
    note: "Ce projet doit être examiné par un conseil juridique avant toute utilisation définitive. Le texte entre [crochets] est complété par la Société.",
    meta: `Version du document : ${version} · Référence du contrat : attribuée lors de la signature`,
    page: ["Page", "sur"],
    parties: [
      ["Société", "[DÉNOMINATION SOCIALE ET FORME JURIDIQUE], numéro d’immatriculation [NUMÉRO D’IMMATRICULATION], siège social [ADRESSE DU SIÈGE], représentée par [REPRÉSENTANT AUTORISÉ], exerçant sous la marque « Brickwise – Fractional Real Estate » (la « Société »). Adresse professionnelle : 370 NE 75th Street, Unit 126, Miami, Floride 33138, États-Unis. Bureau de contact européen : Bobinethöfe 38, 54294 Trèves, Allemagne."],
      ["Client", "Le client identifié sur la page de signature électronique du présent document, titulaire d’un compte client Brickwise vérifié (le « Client »). La Société et le Client sont chacun une « Partie »."],
    ],
    sections: [
      ["1. Parties"],
      ["2. Objet et champ d’application",
        "2.1 Le présent contrat fixe les conditions générales dans lesquelles le Client utilise le portail client Brickwise pour étudier des projets immobiliers, demander des participations fractionnées (« parts »), financer des opérations approuvées et recevoir des rapports et des distributions.",
        "2.2 Le présent contrat est un contrat-cadre. Il ne crée à lui seul aucune participation, ne transfère aucune propriété et n’oblige aucune Partie à conclure une opération. Chaque participation est régie par un avenant de participation propre au bien (l’« Avenant ») précisant le bien, la structure de détention, le prix par part, les droits attachés, les frais, la durée et les conditions de sortie. En cas de contradiction, l’Avenant prévaut pour l’opération concernée.",
        "2.3 Les prix, rendements, calculs, disponibilités et statuts affichés sur le portail sont fournis à titre d’information. Ils ne constituent ni une offre, ni une garantie, ni un conseil en investissement."],
      ["3. Compte client et vérification",
        "3.1 Le Client fournit des informations complètes et exactes, garde ses identifiants confidentiels et informe la Société sans délai de tout changement ou de tout soupçon d’utilisation abusive du compte.",
        "3.2 Avant d’approuver une opération, la Société peut vérifier l’identité, l’adresse, la résidence fiscale, le bénéficiaire effectif et l’origine des fonds du Client. Elle peut refuser ou suspendre une opération et la signaler aux autorités lorsque la réglementation en matière de blanchiment ou de sanctions l’exige."],
      ["4. Déroulement d’une participation",
        "4.1 Le Client soumet une demande sur le portail en indiquant le bien, le nombre de parts et le mode de paiement. Une demande n’engage pas les Parties tant que la Société ne l’a pas confirmée par écrit et que les deux Parties n’ont pas signé l’Avenant.",
        "4.2 Les parts ne sont attribuées qu’après réception effective des fonds, documentation complète et validation de conformité. Les parts affichées comme disponibles peuvent être réservées ou retirées jusqu’à leur attribution. Si une demande ne peut aboutir, les fonds non attribués sont remboursés, déduction faite uniquement des frais communiqués à l’avance."],
      ["5. Paiements et portefeuille client",
        "5.1 Les paiements sont effectués uniquement sur les comptes bancaires ou adresses d’actifs numériques indiqués comme vérifiés dans le portail client, avec la référence de paiement indiquée. La Société ne demande jamais de mots de passe, de clés privées ni de phrases de récupération.",
        "5.2 Les dépôts sont crédités sur le portefeuille du Client dans le portail après confirmation de leur réception par la Société. Pour les actifs numériques, le Client est responsable du choix de l’actif et du réseau corrects ; un transfert vers une mauvaise adresse ou un mauvais réseau peut être irrécupérable. Le montant crédité est le montant en euros confirmé par la Société après conversion éventuelle.",
        "5.3 Tous les montants sont exprimés en euros (EUR), sauf disposition contraire de l’Avenant."],
      ["6. Revenus locatifs et projections",
        "6.1 Le Client participe aux revenus locatifs nets d’un bien au prorata des parts détenues, tels que définis dans l’Avenant. Les revenus locatifs nets correspondent aux loyers effectivement encaissés, déduction faite des frais d’exploitation, de gestion, d’entretien, d’assurance, des impôts, des frais de financement, des réserves et des frais communiqués.",
        "6.2 Les rendements cibles et les montants journaliers, mensuels ou annuels affichés sur le portail sont des projections fondées sur des hypothèses. Ils ne sont pas garantis ; les revenus réels peuvent être inférieurs, retardés ou nuls. Les distributions sont effectuées selon la périodicité prévue dans l’Avenant."],
      ["7. Frais",
        "La Société ne perçoit que les frais prévus dans sa grille tarifaire et dans l’Avenant : [GRILLE TARIFAIRE — p. ex. frais d’entrée, frais de gestion annuels, frais de sortie — À COMPLÉTER]. Tout autre frais requiert l’accord préalable du Client dans l’Avenant."],
      ["8. Durée de détention, cession et sortie",
        "8.1 Les participations s’inscrivent dans le long terme et peuvent être difficiles à céder. [RÈGLES DE SORTIE — durée minimale de détention, préavis, procédure et prix de revente ou de rachat — À COMPLÉTER].",
        "8.2 Une cession ou une sortie n’est possible que dans la mesure permise par l’Avenant et la loi applicable. La Société ne garantit ni acheteur, ni prix de revente, ni date de sortie."],
      ["9. Avertissement sur les risques",
        "Les participations immobilières comportent des risques, notamment la perte partielle ou totale du capital investi, la vacance locative, les impayés, les dommages, la baisse de la valeur des biens, l’évolution des taux d’intérêt, des taux de change, de la fiscalité et de la réglementation, ainsi qu’une liquidité limitée. Les performances passées et les projections ne préjugent pas des résultats futurs. Le Client ne devrait investir que des sommes qu’il peut immobiliser à long terme et il lui est recommandé de consulter un conseil juridique, fiscal et financier indépendant."],
      ["10. Obligations et responsabilité de la Société",
        "10.1 La Société gère le portail et le processus de participation avec diligence, conserve une trace de toutes les opérations, fournit des rapports réguliers et communique les frais et risques significatifs dont elle a connaissance.",
        "10.2 La Société est responsable sans limitation en cas de faute intentionnelle, de faute lourde et d’atteinte à la vie, à l’intégrité physique ou à la santé. Dans les autres cas, et dans la mesure permise par la loi, sa responsabilité est limitée au dommage prévisible et typique pour ce type de contrat. Les droits impératifs des consommateurs ne sont pas affectés."],
      ["11. Protection des données et communication",
        "La Société traite les données personnelles du Client pour exécuter le présent contrat et respecter ses obligations légales, comme décrit dans la politique de confidentialité disponible sur www.brickwise-immo.de/privacy. Les notifications sont adressées via le portail client ou à l’adresse e-mail vérifiée du Client. Le Client accepte de recevoir les documents par voie électronique."],
      ["12. Durée et résiliation",
        "Le présent contrat prend effet à la signature du Client et est conclu pour une durée indéterminée. Chaque Partie peut le résilier par écrit moyennant un préavis de [30] jours. La Société peut suspendre le compte avec effet immédiat pour un motif grave, tel qu’un soupçon de fraude, des sanctions ou un manquement grave. La résiliation n’affecte pas les participations existantes, qui se poursuivent selon leur Avenant."],
      ["13. Droit de rétractation",
        "Si le Client est un consommateur, le droit de rétractation légal s’applique. [INFORMATIONS SUR LA RÉTRACTATION — À COMPLÉTER PAR LE CONSEIL JURIDIQUE]."],
      ["14. Droit applicable et litiges",
        "Le présent contrat est régi par [DROIT APPLICABLE — À CONFIRMER PAR LE CONSEIL JURIDIQUE]. Les consommateurs conservent la protection des dispositions impératives du pays de leur résidence habituelle. Juridiction compétente : [JURIDICTION COMPÉTENTE], sauf disposition impérative contraire. Les Parties s’efforcent d’abord de régler tout litige à l’amiable."],
      ["15. Dispositions finales",
        "Toute modification du présent contrat est notifiée via le portail au moins [30] jours avant son entrée en vigueur. Si une disposition est invalide, les autres dispositions restent en vigueur. Le présent contrat est disponible en anglais, allemand, français, espagnol et italien ; le Client signe la version linguistique choisie sur le portail."],
      ["16. Signature électronique",
        "16.1 Le Client signe le présent contrat électroniquement dans le portail client en traçant sa signature et en confirmant son consentement. La Société enregistre le nom et l’adresse e-mail vérifiée du signataire, la date et l’heure (UTC), l’adresse IP, les informations sur l’appareil ainsi que l’empreinte SHA-256 du présent document, et les joint sur la page de signature électronique.",
        "16.2 Le PDF signé est conservé dans le compte du Client et peut être téléchargé à tout moment. La Société confirme le contrat en vérifiant la signature dans son système d’administration [et par la contre-signature de son représentant autorisé]."],
    ],
    signatures: { heading: "Signatures", company: "Pour la Société", representative: "[REPRÉSENTANT AUTORISÉ — NOM, FONCTION]", line: "Signature / cachet", client: "Client", clientText: "Signé électroniquement sur le portail client Brickwise — voir la page de signature électronique jointe au présent document." },
    consent: "J’ai lu l’intégralité du contrat de coopération client. En traçant ma signature et en cliquant sur « Signer le contrat », j’accepte ses conditions et je le signe électroniquement sous le nom affiché. Une copie PDF signée sera conservée dans mon compte client.",
  },
  es: {
    title: "Contrato de cooperación con el cliente",
    draft: "BORRADOR — REQUIERE REVISIÓN JURÍDICA",
    note: "Este borrador debe ser revisado por un asesor jurídico antes de su uso definitivo. El texto entre [corchetes] lo completa la Sociedad.",
    meta: `Versión del documento: ${version} · Referencia del contrato: se asigna al firmar`,
    page: ["Página", "de"],
    parties: [
      ["Sociedad", "[DENOMINACIÓN SOCIAL Y FORMA JURÍDICA], con número de registro [NÚMERO DE REGISTRO], domicilio social en [DOMICILIO SOCIAL], representada por [REPRESENTANTE AUTORIZADO], que opera bajo la marca «Brickwise – Fractional Real Estate» (la «Sociedad»). Dirección comercial: 370 NE 75th Street, Unit 126, Miami, Florida 33138, EE. UU. Oficina de contacto europea: Bobinethöfe 38, 54294 Tréveris, Alemania."],
      ["Cliente", "El cliente identificado en la página de firma electrónica de este documento, titular de una cuenta de cliente Brickwise verificada (el «Cliente»). La Sociedad y el Cliente son cada uno una «Parte»."],
    ],
    sections: [
      ["1. Partes"],
      ["2. Objeto y alcance",
        "2.1 Este contrato establece las condiciones generales en las que el Cliente utiliza el portal de clientes de Brickwise para analizar proyectos inmobiliarios, solicitar participaciones fraccionadas («participaciones»), financiar operaciones aprobadas y recibir informes y distribuciones.",
        "2.2 Este contrato es un contrato marco. Por sí solo no crea ninguna participación, no transmite la propiedad ni obliga a ninguna Parte a completar una operación. Cada participación se rige por un anexo de participación específico del inmueble (el «Anexo») que indica el inmueble, la estructura de tenencia, el precio por participación, los derechos correspondientes, las comisiones, la duración y las condiciones de salida. En caso de contradicción, prevalece el Anexo para esa operación.",
        "2.3 Los precios, rentabilidades, cálculos, disponibilidades y estados que muestra el portal son meramente informativos. No constituyen una oferta, una garantía ni asesoramiento de inversión."],
      ["3. Cuenta del cliente y verificación",
        "3.1 El Cliente facilita información completa y exacta, mantiene la confidencialidad de sus credenciales de acceso e informa sin demora a la Sociedad de cualquier cambio o sospecha de uso indebido de la cuenta.",
        "3.2 Antes de aprobar una operación, la Sociedad puede verificar la identidad, el domicilio, la residencia fiscal, la titularidad real y el origen de los fondos del Cliente. Puede rechazar o suspender una operación y comunicarla a las autoridades cuando lo exija la normativa de prevención del blanqueo de capitales o de sanciones."],
      ["4. Proceso de participación",
        "4.1 El Cliente envía una solicitud en el portal indicando el inmueble, el número de participaciones y el método de pago. La solicitud no es vinculante hasta que la Sociedad la confirma por escrito y ambas Partes han firmado el Anexo.",
        "4.2 Las participaciones solo se asignan tras la recepción efectiva de los fondos, la documentación completa y la aprobación de cumplimiento normativo. Las participaciones mostradas como disponibles pueden reservarse o retirarse hasta su asignación. Si una solicitud no puede completarse, los fondos no asignados se reembolsan, descontando únicamente los gastos comunicados previamente."],
      ["5. Pagos y monedero del cliente",
        "5.1 Los pagos se realizan únicamente a las cuentas bancarias o direcciones de activos digitales que el portal de clientes muestra como verificadas, indicando la referencia de pago facilitada. La Sociedad nunca solicita contraseñas, claves privadas ni frases de recuperación.",
        "5.2 Los depósitos se abonan en el monedero del Cliente en el portal una vez que la Sociedad confirma su recepción. En el caso de activos digitales, el Cliente es responsable de elegir el activo y la red correctos; las transferencias a una dirección o red equivocada pueden ser irrecuperables. El importe abonado es el importe en euros confirmado por la Sociedad tras la conversión que proceda.",
        "5.3 Todos los importes se expresan en euros (EUR), salvo que el Anexo disponga otra cosa."],
      ["6. Ingresos por alquiler y proyecciones",
        "6.1 El Cliente participa en los ingresos netos por alquiler de un inmueble en proporción a las participaciones que posee, según se define en el Anexo. Los ingresos netos por alquiler son las rentas efectivamente cobradas menos los costes de explotación, gestión, mantenimiento, seguros, impuestos y financiación, las reservas y las comisiones comunicadas.",
        "6.2 Las rentabilidades objetivo y los importes diarios, mensuales o anuales que muestra el portal son proyecciones basadas en hipótesis. No están garantizados; los ingresos reales pueden ser inferiores, retrasarse o no producirse. Las distribuciones se realizan con la periodicidad establecida en el Anexo."],
      ["7. Comisiones",
        "La Sociedad solo cobra las comisiones previstas en su tabla de comisiones y en el Anexo: [TABLA DE COMISIONES — p. ej., comisión de entrada, comisión anual de gestión, comisión de salida — PENDIENTE DE COMPLETAR]. Cualquier otra comisión requiere el acuerdo previo del Cliente en el Anexo."],
      ["8. Periodo de tenencia, transmisión y salida",
        "8.1 Las participaciones son inversiones a largo plazo y pueden ser difíciles de vender. [REGLAS DE SALIDA — periodo mínimo de tenencia, plazo de preaviso, procedimiento y precio de reventa o recompra — PENDIENTE DE COMPLETAR].",
        "8.2 La transmisión o la salida solo son posibles en la medida en que lo permitan el Anexo y la legislación aplicable. La Sociedad no garantiza un comprador, un precio de reventa ni una fecha de salida."],
      ["9. Advertencia de riesgos",
        "Las participaciones inmobiliarias conllevan riesgos, entre ellos la pérdida parcial o total del capital invertido, la desocupación, el impago de inquilinos, los daños, la caída del valor de los inmuebles, los cambios en los tipos de interés, los tipos de cambio, la fiscalidad y la normativa, y una liquidez limitada. Los resultados pasados y las proyecciones no son indicadores fiables de resultados futuros. El Cliente solo debería invertir dinero que pueda inmovilizar a largo plazo y se le recomienda obtener asesoramiento jurídico, fiscal y financiero independiente."],
      ["10. Obligaciones y responsabilidad de la Sociedad",
        "10.1 La Sociedad gestiona el portal y el proceso de participación con la diligencia debida, conserva un registro de todas las operaciones, facilita informes periódicos y comunica las comisiones y los riesgos significativos que conozca.",
        "10.2 La Sociedad responde sin limitación en caso de dolo, culpa grave y daños a la vida, la integridad física o la salud. En los demás casos, y en la medida en que lo permita la ley, su responsabilidad se limita al daño previsible y típico de este tipo de contrato. Los derechos imperativos de los consumidores no se ven afectados."],
      ["11. Protección de datos y comunicaciones",
        "La Sociedad trata los datos personales del Cliente para ejecutar este contrato y cumplir sus obligaciones legales, tal como se describe en la política de privacidad disponible en www.brickwise-immo.de/privacy. Las notificaciones se realizan a través del portal de clientes o en la dirección de correo electrónico verificada del Cliente. El Cliente acepta recibir los documentos por vía electrónica."],
      ["12. Duración y resolución",
        "Este contrato entra en vigor con la firma del Cliente y tiene duración indefinida. Cualquiera de las Partes puede resolverlo por escrito con un preaviso de [30] días. La Sociedad puede suspender la cuenta con efecto inmediato por causa justificada, como sospecha de fraude, sanciones o un incumplimiento grave. La resolución no afecta a las participaciones existentes, que continúan conforme a su Anexo."],
      ["13. Derecho de desistimiento",
        "Si el Cliente es consumidor, se aplica el derecho legal de desistimiento. [INFORMACIÓN SOBRE EL DESISTIMIENTO — PENDIENTE DE COMPLETAR POR EL ASESOR JURÍDICO]."],
      ["14. Ley aplicable y controversias",
        "Este contrato se rige por [LEY APLICABLE — PENDIENTE DE CONFIRMAR POR EL ASESOR JURÍDICO]. Los consumidores conservan la protección de las normas imperativas del país de su residencia habitual. Fuero competente: [FUERO COMPETENTE], salvo que una norma imperativa disponga otra cosa. Las Partes intentarán primero resolver cualquier controversia de forma amistosa."],
      ["15. Disposiciones finales",
        "Las modificaciones de este contrato se notifican a través del portal con al menos [30] días de antelación a su entrada en vigor. Si alguna disposición fuera inválida, las demás seguirán en vigor. Este contrato está disponible en inglés, alemán, francés, español e italiano; el Cliente firma la versión lingüística seleccionada en el portal."],
      ["16. Firma electrónica",
        "16.1 El Cliente firma este contrato electrónicamente en el portal de clientes trazando su firma y confirmando su consentimiento. La Sociedad registra el nombre y la dirección de correo electrónico verificada del firmante, la fecha y la hora (UTC), la dirección IP, la información del dispositivo y la suma de verificación SHA-256 de este documento, y los adjunta en la página de firma electrónica.",
        "16.2 El PDF firmado se guarda en la cuenta del Cliente y puede descargarse en cualquier momento. La Sociedad confirma el contrato al revisar la firma en su sistema de administración [y mediante la contrafirma de su representante autorizado]."],
    ],
    signatures: { heading: "Firmas", company: "Por la Sociedad", representative: "[REPRESENTANTE AUTORIZADO — NOMBRE, CARGO]", line: "Firma / sello", client: "Cliente", clientText: "Firmado electrónicamente en el portal de clientes de Brickwise — véase la página de firma electrónica adjunta a este documento." },
    consent: "He leído íntegramente el contrato de cooperación con el cliente. Al trazar mi firma y pulsar «Firmar contrato», acepto sus condiciones y lo firmo electrónicamente con el nombre indicado. Se guardará una copia en PDF firmada en mi cuenta de cliente.",
  },
  it: {
    title: "Contratto di cooperazione con il cliente",
    draft: "BOZZA — REVISIONE LEGALE NECESSARIA",
    note: "La presente bozza deve essere esaminata da un consulente legale prima dell’uso definitivo. Il testo tra [parentesi quadre] è completato dalla Società.",
    meta: `Versione del documento: ${version} · Riferimento del contratto: assegnato alla firma`,
    page: ["Pagina", "di"],
    parties: [
      ["Società", "[DENOMINAZIONE SOCIALE E FORMA GIURIDICA], numero di registrazione [NUMERO DI REGISTRAZIONE], sede legale [INDIRIZZO DELLA SEDE], rappresentata da [RAPPRESENTANTE AUTORIZZATO], che opera con il marchio «Brickwise – Fractional Real Estate» (la «Società»). Indirizzo commerciale: 370 NE 75th Street, Unit 126, Miami, Florida 33138, USA. Ufficio di contatto europeo: Bobinethöfe 38, 54294 Treviri, Germania."],
      ["Cliente", "Il cliente indicato nella pagina di firma elettronica del presente documento, titolare di un account cliente Brickwise verificato (il «Cliente»). La Società e il Cliente sono ciascuno una «Parte»."],
    ],
    sections: [
      ["1. Parti"],
      ["2. Oggetto e ambito",
        "2.1 Il presente contratto stabilisce le condizioni generali alle quali il Cliente utilizza il portale clienti Brickwise per esaminare progetti immobiliari, richiedere partecipazioni frazionate («quote»), finanziare operazioni approvate e ricevere rendiconti e distribuzioni.",
        "2.2 Il presente contratto è un contratto quadro. Di per sé non crea alcuna partecipazione, non trasferisce la proprietà e non obbliga alcuna Parte a concludere un’operazione. Ogni partecipazione è disciplinata da un addendum di partecipazione specifico per l’immobile (l’«Addendum») che indica l’immobile, la struttura di detenzione, il prezzo per quota, i diritti connessi, le commissioni, la durata e le condizioni di uscita. In caso di contrasto, per l’operazione interessata prevale l’Addendum.",
        "2.3 Prezzi, rendimenti, calcoli, disponibilità e stati mostrati nel portale hanno carattere puramente informativo. Non costituiscono un’offerta, una garanzia né una consulenza in materia di investimenti."],
      ["3. Account cliente e verifica",
        "3.1 Il Cliente fornisce informazioni complete ed esatte, mantiene riservate le proprie credenziali di accesso e informa senza ritardo la Società di qualsiasi modifica o sospetto uso improprio dell’account.",
        "3.2 Prima di approvare un’operazione, la Società può verificare l’identità, l’indirizzo, la residenza fiscale, il titolare effettivo e l’origine dei fondi del Cliente. Può rifiutare o sospendere un’operazione e segnalarla alle autorità quando lo richiedono le norme antiriciclaggio o in materia di sanzioni."],
      ["4. Procedura di partecipazione",
        "4.1 Il Cliente invia una richiesta nel portale indicando l’immobile, il numero di quote e il metodo di pagamento. La richiesta non è vincolante finché la Società non la conferma per iscritto ed entrambe le Parti non hanno firmato l’Addendum.",
        "4.2 Le quote sono assegnate solo dopo l’effettivo incasso dei fondi, il completamento della documentazione e l’approvazione di conformità. Le quote indicate come disponibili possono essere riservate o ritirate fino all’assegnazione. Se una richiesta non può essere completata, i fondi non assegnati vengono rimborsati, al netto esclusivamente dei costi comunicati in anticipo."],
      ["5. Pagamenti e wallet del cliente",
        "5.1 I pagamenti sono effettuati esclusivamente sui conti bancari o sugli indirizzi di asset digitali indicati come verificati nel portale clienti, utilizzando il riferimento di pagamento indicato. La Società non chiede mai password, chiavi private o frasi di recupero.",
        "5.2 I versamenti sono accreditati sul wallet del Cliente nel portale dopo che la Società ne ha confermato la ricezione. Per gli asset digitali, il Cliente è responsabile della scelta dell’asset e della rete corretti; i trasferimenti a un indirizzo o a una rete errati possono essere irrecuperabili. L’importo accreditato è l’importo in euro confermato dalla Società dopo l’eventuale conversione.",
        "5.3 Tutti gli importi sono espressi in euro (EUR), salvo diversa previsione dell’Addendum."],
      ["6. Redditi da locazione e proiezioni",
        "6.1 Il Cliente partecipa ai redditi netti da locazione di un immobile in proporzione alle quote detenute, come definito nell’Addendum. Per redditi netti da locazione si intendono i canoni effettivamente incassati, al netto dei costi di gestione operativa, amministrazione, manutenzione, assicurazione, delle imposte, dei costi di finanziamento, delle riserve e delle commissioni comunicate.",
        "6.2 I rendimenti obiettivo e gli importi giornalieri, mensili o annuali mostrati nel portale sono proiezioni basate su ipotesi. Non sono garantiti; i redditi effettivi possono essere inferiori, ritardati o nulli. Le distribuzioni avvengono con la periodicità stabilita nell’Addendum."],
      ["7. Commissioni",
        "La Società applica esclusivamente le commissioni previste nel proprio tariffario e nell’Addendum: [TARIFFARIO — ad es. commissione di ingresso, commissione annuale di gestione, commissione di uscita — DA COMPLETARE]. Qualsiasi altra commissione richiede il previo consenso del Cliente nell’Addendum."],
      ["8. Periodo di detenzione, trasferimento e uscita",
        "8.1 Le partecipazioni hanno un orizzonte di lungo periodo e possono essere difficili da vendere. [REGOLE DI USCITA — periodo minimo di detenzione, preavviso, procedura e prezzo di rivendita o riacquisto — DA COMPLETARE].",
        "8.2 Il trasferimento o l’uscita sono possibili solo nei limiti consentiti dall’Addendum e dalla legge applicabile. La Società non garantisce un acquirente, un prezzo di rivendita né una data di uscita."],
      ["9. Avvertenza sui rischi",
        "Le partecipazioni immobiliari comportano rischi, tra cui la perdita parziale o totale del capitale investito, lo sfitto, la morosità degli inquilini, i danni, il calo del valore degli immobili, le variazioni di tassi d’interesse, tassi di cambio, imposte e normativa, nonché una liquidità limitata. I risultati passati e le proiezioni non sono indicatori affidabili dei risultati futuri. Il Cliente dovrebbe investire solo somme che può vincolare a lungo termine e gli si raccomanda di ottenere una consulenza legale, fiscale e finanziaria indipendente."],
      ["10. Obblighi e responsabilità della Società",
        "10.1 La Società gestisce il portale e la procedura di partecipazione con la dovuta diligenza, registra tutte le operazioni, fornisce rendiconti periodici e comunica le commissioni e i rischi rilevanti di cui è a conoscenza.",
        "10.2 La Società risponde senza limitazioni in caso di dolo, colpa grave e danni alla vita, all’integrità fisica o alla salute. Negli altri casi, nei limiti consentiti dalla legge, la responsabilità è limitata al danno prevedibile e tipico per questo tipo di contratto. Restano salvi i diritti inderogabili dei consumatori."],
      ["11. Protezione dei dati e comunicazioni",
        "La Società tratta i dati personali del Cliente per eseguire il presente contratto e adempiere agli obblighi di legge, come descritto nell’informativa sulla privacy disponibile su www.brickwise-immo.de/privacy. Le comunicazioni avvengono tramite il portale clienti o all’indirizzo e-mail verificato del Cliente. Il Cliente accetta di ricevere i documenti in formato elettronico."],
      ["12. Durata e recesso",
        "Il presente contratto entra in vigore con la firma del Cliente ed è a tempo indeterminato. Ciascuna Parte può recedere per iscritto con un preavviso di [30] giorni. La Società può sospendere l’account con effetto immediato per giusta causa, ad esempio in caso di sospetta frode, sanzioni o grave inadempimento. Il recesso non incide sulle partecipazioni esistenti, che proseguono secondo il relativo Addendum."],
      ["13. Diritto di recesso del consumatore",
        "Se il Cliente è un consumatore, si applica il diritto di recesso previsto dalla legge. [INFORMAZIONI SUL DIRITTO DI RECESSO — DA COMPLETARE A CURA DEL CONSULENTE LEGALE]."],
      ["14. Legge applicabile e controversie",
        "Il presente contratto è disciplinato da [LEGGE APPLICABILE — DA CONFERMARE A CURA DEL CONSULENTE LEGALE]. I consumatori mantengono la tutela delle norme inderogabili del Paese di residenza abituale. Foro competente: [FORO COMPETENTE], salvo diversa disposizione inderogabile. Le Parti cercheranno innanzitutto di risolvere ogni controversia in via amichevole."],
      ["15. Disposizioni finali",
        "Le modifiche al presente contratto sono comunicate tramite il portale almeno [30] giorni prima della loro entrata in vigore. Se una disposizione è invalida, le restanti disposizioni restano in vigore. Il presente contratto è disponibile in inglese, tedesco, francese, spagnolo e italiano; il Cliente firma la versione linguistica selezionata nel portale."],
      ["16. Firma elettronica",
        "16.1 Il Cliente firma il presente contratto elettronicamente nel portale clienti tracciando la propria firma e confermando il consenso. La Società registra il nome e l’indirizzo e-mail verificato del firmatario, la data e l’ora (UTC), l’indirizzo IP, le informazioni sul dispositivo e l’impronta SHA-256 del presente documento, e li allega nella pagina di firma elettronica.",
        "16.2 Il PDF firmato è conservato nell’account del Cliente e può essere scaricato in qualsiasi momento. La Società conferma il contratto verificando la firma nel proprio sistema di amministrazione [e mediante la controfirma del proprio rappresentante autorizzato]."],
    ],
    signatures: { heading: "Firme", company: "Per la Società", representative: "[RAPPRESENTANTE AUTORIZZATO — NOME, QUALIFICA]", line: "Firma / timbro", client: "Cliente", clientText: "Firmato elettronicamente nel portale clienti Brickwise — vedere la pagina di firma elettronica allegata al presente documento." },
    consent: "Ho letto integralmente il contratto di cooperazione con il cliente. Tracciando la mia firma e cliccando su «Firma il contratto», ne accetto le condizioni e lo firmo elettronicamente con il nome indicato. Una copia PDF firmata sarà conservata nel mio account cliente.",
  },
};

const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const text = (value) => escapeHtml(value).replace(/\[[^\]]+\]/g, (placeholder) => `<span class="ph">${placeholder}</span>`);
const cssString = (value) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

function html(locale, doc) {
  const [first, ...rest] = doc.sections;
  const body = rest.map(([heading, ...paragraphs]) => `<section><h2>${escapeHtml(heading)}</h2>${paragraphs.map((paragraph) => `<p>${text(paragraph)}</p>`).join("")}</section>`).join("");
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title><style>
@page{size:A4;margin:17mm 17mm 19mm;@bottom-left{content:${cssString(`Brickwise · ${doc.title} · ${version}`)};font:7.5pt Arial,sans-serif;color:#6b7689}@bottom-right{content:${cssString(doc.page[0] + " ")} counter(page) ${cssString(" " + doc.page[1] + " ")} counter(pages);font:7.5pt Arial,sans-serif;color:#6b7689}}
*{box-sizing:border-box}body{margin:0;color:#14213d;font:9.6pt/1.48 Georgia,"Times New Roman",serif}
.top{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:7px;border-bottom:2px solid #1667a8}
.brand b{display:block;font:800 15pt Arial,sans-serif;letter-spacing:.06em}.brand span{font:700 6.2pt Arial,sans-serif;letter-spacing:.32em;color:#1667a8}
.draft{padding:4px 8px;border:1px solid #e0912f;color:#9a3d07;font:700 6.8pt Arial,sans-serif;letter-spacing:.06em}
h1{margin:12px 0 2px;text-align:center;font:700 17pt Georgia,serif}.meta{margin:0 0 8px;text-align:center;color:#5b6678;font:8pt Arial,sans-serif}
.note{margin:0 0 8px;padding:6px 10px;border-left:3px solid #e3a12f;background:#fff7e6;font:8pt/1.45 Arial,sans-serif}
h2{margin:9px 0 3px;padding-bottom:2px;border-bottom:1px solid #d5dde8;font:700 10.2pt Georgia,serif;break-after:avoid}
p{margin:0 0 4px;text-align:justify;orphans:3;widows:3}section{break-inside:auto}
table{width:100%;border-collapse:collapse;margin:2px 0 4px}td{padding:4px 8px;border:1px solid #d5dde8;vertical-align:top}td:first-child{width:22%;background:#f4f7fb;font:700 8.6pt Arial,sans-serif}
.ph{padding:0 2px;background:#fff1b8}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px;break-inside:avoid}
.box{min-height:118px;padding:9px 11px;border:1px solid #c9d3e0;font:8.6pt/1.45 Arial,sans-serif}.box h3{margin:0 0 4px;font:700 8.6pt Arial,sans-serif;text-transform:uppercase;letter-spacing:.05em}
.line{margin-top:30px;padding-top:3px;border-top:1px solid #14213d;color:#5b6678;font-size:7.6pt}.seal{float:right;width:62px;margin:-2px 0 0 8px}
</style></head><body>
<div class="top"><div class="brand"><b>BRICKWISE</b><span>FRACTIONAL REAL ESTATE</span></div><div class="draft">${escapeHtml(doc.draft)}</div></div>
<h1>${escapeHtml(doc.title)}</h1><p class="meta">${escapeHtml(doc.meta)}</p><p class="note">${text(doc.note)}</p>
<section><h2>${escapeHtml(first[0])}</h2><table>${doc.parties.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${text(value)}</td></tr>`).join("")}</table></section>
${body}
<section><h2>${escapeHtml(doc.signatures.heading)}</h2><div class="sign">
<div class="box"><img class="seal" src="${seal}" alt=""><h3>${escapeHtml(doc.signatures.company)}</h3><div>${text(doc.signatures.representative)}</div><div class="line">${escapeHtml(doc.signatures.line)}</div></div>
<div class="box"><h3>${escapeHtml(doc.signatures.client)}</h3><div>${escapeHtml(doc.signatures.clientText)}</div></div>
</div></section></body></html>`;
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const locales = ["en", "de", "fr", "es", "it"];
const preview = process.env.AGREEMENT_PREVIEW_DIR;
if (preview) {
  // Layout check only: writes throwaway PDFs and leaves the archive and manifest untouched.
  mkdirSync(preview, { recursive: true });
  for (const locale of locales) {
    const source = path.join(preview, `${locale}.html`);
    writeFileSync(source, html(locale, documents[locale]));
    execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files", `--print-to-pdf=${path.join(preview, `${locale}.pdf`)}`, pathToFileURL(source).href], { stdio: "ignore" });
  }
  console.log(`Preview PDFs written to ${preview}.`);
  process.exit(0);
}
if (!existsSync(folder)) {
  mkdirSync(folder, { recursive: true });
  const work = mkdtempSync(path.join(tmpdir(), "brickwise-agreement-"));
  for (const locale of locales) {
    const source = path.join(work, `${locale}.html`);
    writeFileSync(source, html(locale, documents[locale]));
    execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--allow-file-access-from-files", `--print-to-pdf=${path.join(folder, `${locale}.pdf`)}`, pathToFileURL(source).href], { stdio: "ignore" });
  }
  console.log(`Generated ${locales.length} PDFs in ${path.relative(root, folder)}.`);
} else {
  console.log(`${version} already exists; verifying the archived PDFs instead of regenerating them.`);
}

const manifest = {
  version,
  documents: locales.map((locale) => {
    const bytes = readFileSync(path.join(folder, `${locale}.pdf`));
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error(`${locale}.pdf is not a PDF.`);
    return { locale, path: `/documents/agreements/${version}/${locale}.pdf`, sha256: sha256(bytes), consentText: documents[locale].consent, isDraft: true, requiresSignature: true };
  }),
};
const target = path.join(root, "app", "lib", "agreement-manifest.json");
const serialized = JSON.stringify(manifest, null, 2) + "\n";
if (existsSync(target)) {
  const previous = JSON.parse(readFileSync(target, "utf8"));
  if (previous.version === version && JSON.stringify(previous) !== JSON.stringify(manifest)) throw new Error("Manifest is immutable. Create a new version.");
}
writeFileSync(target, serialized);
console.log(`Manifest ${version} written.`);
