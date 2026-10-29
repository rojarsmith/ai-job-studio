// Knock-out and sensitive questions (design S5): detected by label, never auto-filled, always needs_confirmation.
export const KNOCKOUT_RULES = [
  ['work_auth', /authori[sz]ed to work|legally (able|eligible|entitled) to work|right to work|work (permit|authori[sz]ation)|eligib(le|ility) to work|工作許可|工作簽證/i],
  ['sponsorship', /sponsor|visa|h-?1b|immigration|簽證/i],
  ['salary', /salary|compensation|expected pay|desired pay|hourly rate|薪資|薪水|待遇/i],
  ['relocation', /relocat|willing to move|外派|調動|搬遷/i],
  ['legal', /felony|convict|criminal|background check|drug (test|screen)|前科|犯罪/i],
  ['demographic', /gender|race|ethnic|veteran|disabilit|sexual orientation|religion|pregnan|marital|性別|種族|宗教|婚姻/i],
  ['age', /\bage\b|date of birth|birth ?date|年齡|出生/i],
  ['non_compete', /non-?compete|current employer|notice period|resign|競業|離職/i],
  ['security_clearance', /security clearance|clearance level|安全許可/i],
  ['commitment', /minimum (years|commitment)|agree to|certify|acknowledge|consent|同意|保證/i],
];
export function knockoutCategory(label) {
  const l = String(label ?? '');
  for (const [cat, re] of KNOCKOUT_RULES) if (re.test(l)) return cat;
  return null;
}
/** Scan posting text for likely knock-out questions, for the report's knock-outs line. */
export function knockoutsInText(text) {
  const found = new Set();
  for (const [cat, re] of KNOCKOUT_RULES) if (re.test(String(text ?? ''))) found.add(cat);
  return [...found];
}
