# Debug Session: firefox-login-crash [OPEN]

## Symptoom
- App opent in Chrome, maar crasht bij een collega in Firefox met `ReferenceError` tijdens initial load op Netlify.

## Scope
- Productie / Netlify
- Browser-specifiek
- Mogelijk iOS Firefox / WebKit pad

## Hypotheses
1. Een browser-extension of ingebedde third-party snippet injecteert code/globals die alleen in Firefox/iOS stuklopen.
2. Een moderne syntax of bundler-output wordt in deze browser niet correct verwerkt tijdens initial load.
3. Een module of asset in de eerste render veroorzaakt een top-level exception voordat React volledig mount.
4. Een browser-specifieke codepad in auth, service worker of storage initialisatie veroorzaakt de crash.
5. De foutoverlay/debug-console vangt een secundaire fout, terwijl de primaire crash uit een eerder geladen script komt.

## Plan
1. Productie-entry en eerste render pad inspecteren zonder business logic te wijzigen.
2. Alleen instrumentatie toevoegen in de vroegste loadfase.
3. Lokale reproduceerbaarheid en productiebewijs vergelijken.
4. Pas na bewijs een minimale fix toepassen.
