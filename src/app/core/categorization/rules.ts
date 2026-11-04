import { BENEFITS, INTEREST, SALARY, SAVINGS } from '../models/category';

export interface CategoryRule {
  readonly category: string;
  readonly pattern: RegExp;
}

const rule = (category: string, pattern: string): CategoryRule => ({
  category,
  pattern: new RegExp(pattern, 'i'),
});

/** Checked first for incoming money, matched against counterparty name + description. */
export const INCOME_RULES: readonly CategoryRule[] = [
  rule(
    SALARY,
    String.raw`salaris|\bloon\b|salary|payroll|vakantiegeld|vakantietoeslag|eindejaarsuitkering|13e maand`,
  ),
  rule(
    BENEFITS,
    String.raw`belastingdienst|toeslag|\bsvb\b|kinderbijslag|\buwv\b|uitkering|\bduo\b|studiefinanciering|pensioen|\baow\b`,
  ),
  rule(INTEREST, String.raw`\brente\b|interest`),
];

/** Checked in order for all money; the first match wins. Covers common Dutch payees. */
export const EXPENSE_RULES: readonly CategoryRule[] = [
  rule(
    SAVINGS,
    String.raw`spaarrekening|\bsparen\b|degiro|meesman|brand new day|\bbux\b|trade republic|peaks|lightyear|saxo|binck|semmie|bitvavo|coinbase|kraken|beleggen|vermogensbeheer`,
  ),
  rule('Betaalverzoeken', String.raw`tikkie|betaalverzoek`),
  rule('Contant geld', String.raw`geldautomaat|geldopname|\bcash\b`),
  rule(
    'Wonen',
    String.raw`\bhuur\b|hypothe[ek]|woningcorporatie|\bvve\b|vereniging van eigenaren|ymere|vestia|eigen haard|de alliantie|portaal|woonstad|mitros|stadgenoot|woonbron|havensteder`,
  ),
  rule(
    'Energie & water',
    String.raw`eneco|vattenfall|essent|greenchoice|budget energie|vandebron|energiedirect|engie|oxxio|pure energie|frank energie|tibber|vitens|evides|dunea|waternet|brabant water|\bpwn\b|\bwml\b|oasen|stedin|liander|enexis`,
  ),
  rule(
    'Boodschappen',
    String.raw`albert heijn|\bah\b|jumbo|lidl|aldi|\bplus\b|\bdirk\b|\bcoop\b|\bspar\b|vomar|hoogvliet|dekamarkt|ekoplaza|picnic|crisp|\bflink\b|poiesz|jan linders|nettorama|marqt|supermarkt`,
  ),
  rule(
    'Verzekeringen',
    String.raw`verzeker|centraal beheer|zilveren kruis|\bcz\b|\bvgz\b|menzis|ohra|interpolis|a\.s\.r|\basr\b|fbto|aegon|unive|univé|nationale nederlanden|allianz|ditzo|\bdsw\b|onvz|inshared|klaverblad|zorgverzekeraar`,
  ),
  rule(
    'Abonnementen & telecom',
    String.raw`netflix|spotify|disney|videoland|\bhbo\b|viaplay|youtube|apple\.com|itunes|google|\bkpn\b|ziggo|odido|t-mobile|vodafone|simyo|youfone|lebara|tele2|hollandsnieuwe|delta fiber|openai|chatgpt|adobe|microsoft|dropbox|basic-fit|sportcity|anytime fitness|dpg media|volkskrant|\bnrc\b|telegraaf|abonnement`,
  ),
  rule(
    'Vervoer',
    String.raw`\bns\b|ns groep|ns reizigers|shell|\bbp\b|esso|tango|tinq|tamoil|totalenergies|texaco|argos|ov-chipkaart|translink|\bgvb\b|\bret\b|\bhtm\b|arriva|connexxion|qbuzz|keolis|parkeer|parkeren|q-park|parkmobile|yellowbrick|easypark|anwb|\brdw\b|swapfiets|\buber\b(?! ?eats)|\bbolt\b|felyx|greenwheels|mywheels|snappcar|fastned|allego|garage|\bapk\b|kwik-fit|tankstation`,
  ),
  rule(
    'Eten & drinken',
    String.raw`thuisbezorgd|takeaway|uber ?eats|deliveroo|mcdonald|burger king|\bkfc\b|subway|domino|new york pizza|starbucks|coffee|koffie|\bcaf[eé](?![a-zà-ÿ])|restaurant|eetcaf|brasserie|bistro|pizzeria|sushi|lunchroom|bakker|febo|smullers|la place|vapiano`,
  ),
  rule(
    'Winkelen',
    String.raw`bol\.com|coolblue|zalando|\bhema\b|\baction\b|ikea|kruidvat|\betos\b|primark|amazon|mediamarkt|gamma|praxis|karwei|hornbach|blokker|wehkamp|h ?& ?m|\bzara\b|c ?& ?a|decathlon|intertoys|xenos|leen bakker|jysk|wibra|zeeman|ali ?express|\btemu\b|shein|marktplaats|vinted`,
  ),
  rule(
    'Gezondheid',
    String.raw`apotheek|tandarts|huisarts|fysio|ziekenhuis|optiek|pearle|hans anders|specsavers|mondzorg|psycholoog|huidarts`,
  ),
  rule(
    'Belastingen & overheid',
    String.raw`belastingdienst|gemeente|waterschap|\bcjib\b|\bduo\b|rijksdienst|\bbsgw\b|\bgbt\b|svhw|bghu|cocensus|\brbg\b|gblt|provincie|leges`,
  ),
  rule(
    'Kinderen & onderwijs',
    String.raw`kinderopvang|\bbso\b|kinderdagverblijf|partou|kids ?first|smallsteps|humankind|universiteit|hogeschool|ouderbijdrage|lesgeld|schoolgeld`,
  ),
  rule(
    'Vrije tijd & reizen',
    String.raw`booking\.com|airbnb|transavia|\bklm\b|ryanair|easyjet|vueling|corendon|\btui\b|sunweb|hotel|camping|path[eé]|kinepolis|ticketmaster|eventim|museum|efteling|steam|playstation|nintendo|xbox|bioscoop|center parcs|landal|roompot`,
  ),
];

/** Bank codes for cash withdrawals (Rabobank `ga`, ING `gm`). */
export const ATM_CODES: readonly string[] = ['ga', 'gm'];

/** Rabobank code for a transfer between the customer's own accounts. */
export const OWN_TRANSFER_CODE = 'tb';
