-- Seed op basis van de Pocket opnames van 12 en 13 augustus 2026.
-- De aliassen zijn letterlijk overgenomen uit de transcripten. Vul aan zodra je
-- nieuwe verhaspelingen tegenkomt: dat is de goedkoopste kwaliteitswinst.

-- --------------------------------------------------------------- personen

with v(name, role, organisation, is_internal, aliases) as (values
('Marten van Toor', 'Operations Manager', 'Foodconnect', true,
   array['Marten','Martin','Market','Marden']),
('Joost',    'Manager Supply Chain en Logistiek', 'Foodconnect', true,
   array['Joost','Joord','Joodproces']),
('Marije',   'Manager QESH', 'Foodconnect', true,
   array['Marije','Marij','Marijn']),
('Dyenna',   'Productontwikkeling', 'Foodconnect', true,
   array['Dyenna','Jenna','Jenner','Jana','Jenne']),
('Marit',    'Verantwoordelijk stellinginrichting en kleurcodering', 'Foodconnect', true,
   array['Marit','Marik','Maalit','Malit']),
('Bettina',  'Verantwoordelijk vastleggen TWI trainingen', 'Foodconnect', true,
   array['Bettina','Betina','patina','Tina','de Tina']),
('Bert',     null, 'Foodconnect', true, array['Bert','Bart']),
('Jasper',   'Contactpersoon grondstoffen', null, false, array['Jasper']),
('Bibi',     'Category Manager Diepvries', 'Albert Heijn', false, array['Bibi'])
),
bijwerken as (
  -- seed.sql is de onderhouden bron voor referentiedata: een nieuwe
  -- verhaspeling of een aangescherpte omschrijving landt zo op elke omgeving.
  update people t set
        role = v.role,
        organisation = v.organisation,
        is_internal = v.is_internal,
        aliases = v.aliases
  from v where t.name = v.name returning 1
)
insert into people (name, role, organisation, is_internal, aliases)
select name, role, organisation, is_internal, aliases from v
where not exists (select 1 from people t where t.name = v.name);
-- LET OP: Bibi's naam valt in de opname van 12 augustus geen enkele keer. De
-- ASR kan hem dus nog niet verhaspeld hebben; vul aliassen aan zodra je een
-- verhaspeling ziet. Zij zit aan de klantzijde: Foodconnect kookt, AH keurt.

-- LET OP: Marit en Marije lijken in ASR sterk op elkaar en worden in het
-- transcript door elkaar gehaald. Behandel een match op 'Mari' altijd als
-- laag vertrouwen en stuur naar triage.

-- --------------------------------------------------------------- projecten

with v(name, code, description, aliases) as (values
('AH Private Label vriesmaaltijden',
 'AHPL',
 'Receptuurontwikkeling, verpakking en systeeminvoer voor de Albert Heijn private label vriesmaaltijden. Foodconnect produceert, Albert Heijn is de klant; Bibi is daar Category Manager Diepvries. Staat los van het strategisch partnerschap op Maaltijd Thuis, ook al gaat het bij beide om Albert Heijn. Systeemdeadline 9 september 2026.',
 array['private label','PL','ronde 4','AH maaltijden','vriesmaaltijden']),

('BLK implementatie',
 'BLK',
 'Invoering Beter Leven Keurmerk in productie en opslag: verantwoordelijkheden, kleurcodering, scheiding en kruisbesmetting.',
 array['Beter Leven','BLK','BOK','bij elkaar','keurmerk']),

('Digitalisering ingangscontrole',
 'INGC',
 'Van steekproef naar volledige batchregistratie bij goederenontvangst, vastgelegd in de app. Inclusief procedure en werkinstructies.',
 array['ingangscontrole','goederenontvangst','EFA app','batchregistratie']),

('Werving QA/QC Manager',
 'QAQC',
 'Werving en selectie QA/QC Manager. GEVOELIG: standaard uitgesloten van extractie.',
 array['QA manager','QC manager','vacature kwaliteit'])
),
bijwerken as (
  -- seed.sql is de onderhouden bron voor referentiedata: een nieuwe
  -- verhaspeling of een aangescherpte omschrijving landt zo op elke omgeving.
  update projects t set
        name = v.name,
        description = v.description,
        aliases = v.aliases
  from v where t.code = v.code returning 1
)
insert into projects (name, code, description, aliases)
select name, code, description, aliases from v
where not exists (select 1 from projects t where t.code = v.code);

-- --------------------------------------------------------------- termen
-- De variants komen letterlijk uit de transcripten. Dit is de tabel die je bij
-- elke extractie meegeeft.

with v(term, expansion, domain, variants, note) as (values
('BLK', 'Beter Leven Keurmerk', 'kwaliteit',
  array['bij elkaar','bij elkaar product','BOK','bok','B elkaar','bij elkaar producten'],
  'Meest voorkomende en meest schadelijke verhaspeling. De ASR maakt er consequent "bij elkaar" van, wat als gewone Nederlandse woordgroep leest.'),

('TWI', 'Training Within Industry, standaard werkinstructies', 'proces',
  array['TWI','de TV s','TV''s','TWA'], null),

('WNG', 'kleurcode groen bij goedgekeurde levering', 'proces',
  array['WNG','WMG','wng'],
  'Betekenis nog niet zeker. Bevestigen bij Marije voordat dit hard in de procedure gaat.'),

('EFA app', 'app voor registratie ingangscontrole', 'proces',
  array['EFA','EFA app','die app','EIP','de app'], null),

('Oma''s Stoofvlees', null, 'product',
  array['Oma s Bonderstoon','Oma Stoaf','oma s onderstukken','Hollandse stoof','Hollandstroom','de stoof'],
  'Versie 1 is huidig, versie 2 is de aangepaste en te natte variant.'),

('Boeuf Bourguignon', null, 'product',
  array['Busbor in Johann','Bourbignon','bourguillon','Bourbon','boerill','de bol','de boel'], null),

('Thaise curry', null, 'product',
  array['de taal','de curry','Thaise curry','de tail'],
  'Wordt in het transcript stelselmatig "de taal". Zonder woordenboek onvindbaar.'),

('Zuurkoolmaaltijd', null, 'product',
  array['zuurkool','casuur','de zuur','zuurkomaltijd'], null),

('Rode kool', null, 'product', array['rode kool','rooikool','rode kool grondstof'], null),

('Rookworst VZ', 'nieuwe rookworst van leverancier VZ', 'product',
  array['rookworst VZ','rookas vanuit VZ','rookpas'], null),

('E224', 'sulfiet, te vermijden E nummer', 'kwaliteit',
  array['E224','E 224','een nummer'], null),

('Nutri-score', null, 'kwaliteit', array['Nutri-score','Nutriscore','nutri score'], null),

('Jumbo', 'concurrent, hoofdkantoor Veghel', 'organisatie',
  array['Jumbo','Vegel','Veghel','concollega s in Vegel'], null),

('Albert Heijn', null, 'organisatie', array['AH','Albert Heijn','Appie'], null),

('Vitalis', 'verzorgingsinstelling, klant', 'organisatie', array['Vitalis'], null),

('kruisbesmetting', null, 'kwaliteit',
  array['kruisbesmetting','kruisbestun','besmettingstraf'], null),

('ingangscontrole', null, 'proces',
  array['ingangscontrole','in gangcontrole','ingangs controle'], null)
),
bijwerken as (
  -- seed.sql is de onderhouden bron voor referentiedata: een nieuwe
  -- verhaspeling of een aangescherpte omschrijving landt zo op elke omgeving.
  update terms t set
        expansion = v.expansion,
        domain = v.domain,
        variants = v.variants,
        note = v.note
  from v where t.term = v.term returning 1
)
insert into terms (term, expansion, domain, variants, note)
select term, expansion, domain, variants, note from v
where not exists (select 1 from terms t where t.term = v.term);
