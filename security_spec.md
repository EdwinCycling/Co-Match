# Security Specification - AI Cohousing Matchmaker

## Data Invariants
1. Een AI-instelling kan alleen worden gelezen door ingelogde gebruikers.
2. AI-instellingen kunnen alleen worden geschreven door Administrators.
3. Een Match Report is privé voor de betrokkenen (Zoeker, Aanbieder) en de Admin.
4. Anonimiteit wordt ondersteund voor Zoekers, maar Admins moeten geverifieerd zijn via e-mail.

## De "Dirty Dozen" Payloads (Aanvalsscenario's)
1. **Identiteitsspoofing**: Een anonieme gebruiker probeert `role_instruction` te wijzigen. (Moet worden geweigerd)
2. **Onbevoegd Lezen**: Een niet-ingelogde gebruiker probeert admin-instellingen te lezen. (Moet worden geweigerd)
3. **Data Vergiftiging**: Een admin probeert een 1MB tekst in een klein veld te proppen. (Moet worden geweigerd door size checks)
4. **Match Snuffelen**: Gebruiker A probeert het match-rapport van Gebruiker B en C te lezen. (Moet worden geweigerd)
5. **Role Escalation**: Een gebruiker probeert zijn eigen rol naar 'admin' te updaten in het `users` document. (Moet worden geweigerd)
6. **Orphaned Match**: Een match aanmaken voor een niet-bestaande woning. (Moet worden geweigerd door exists check)
7. **Bypass Validation**: Een update sturen zonder de verplichte `updatedAt` server timestamp. (Moet worden geweigerd)
8. **Shadow Field**: Een extra veld `premium: true` toevoegen aan een profiel dat niet in de schema staat. (Moet worden geweigerd door hasOnly keys)

## Test Plan
- Verifieer dat `edwin@editsolutions.nl` admin rechten krijgt.
- Verifieer dat anonieme gebruikers matches kunnen genereren maar geen AI-instellingen kunnen wijzigen.
