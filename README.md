# 6x0k Space 1.8.75

Diese Version behält die vorhandene MSP2-Funktionslogik bei und verwendet eine Dear-ImGui-inspirierte Desktop-Oberfläche: flache Panels, kompakte Controls, geringe Rundungen, dunkles Theme und violette Akzente.

Die zuvor entfernten Credential-/Keylogging-/Vault-/Remote-Gate-Funktionen bleiben entfernt. Feedback bleibt deaktiviert.

Projekt: https://github.com/6x0k

Hinweis: Die Oberfläche ist lokal und CSP-kompatibel; sie verwendet die vorhandene UI-Logik und kein externes CDN.

## Table of Contents

- [What's New in 1.8.75](#whats-new-in-1875)

## What's New in 1.8.75

Im Vergleich zu 1.8.73.5 wurden mehrere sinnvolle Funktionen und Stabilitätsverbesserungen aus der neueren Version übernommen:

### Autogramm / Greeting
- Verbesserte Greeting-Retry-Logik für vorübergehend fehlgeschlagene Aktionen.
- Intelligenteres Cooldown-Handling, einschließlich VIP- und serverseitiger Wartezeiten.
- Verbesserte Behandlung von Fehlern wie Cooldown, Daily Cap und temporären Request-Fehlern.
- Neuer Autogramm-Status mit Fortschritt, gesendeter Anzahl, Zielanzahl und nächster Aktion.
- Zuverlässigere Autogramm-Timer über den Extension-Background mit `chrome.alarms`.
- Besseres Wiederaufnehmen bzw. Aktualisieren des Autogramm-Status nach einem Tab-Wechsel.

### Performance & Daten
- Verbesserter lokaler Cache für die D1-, D2- und D3-Datenpakete.
- D3-Daten können im Hintergrund vorgewärmt werden, damit Features schneller verfügbar sind.
- Neuer leichter Home-Katalog, während vollständige Home-Daten erst bei Bedarf geladen werden.
- Verbesserter Avatar-/Face-Cache für wiederholt verwendete Profile und User.
- Weniger unnötige Datenverarbeitung durch gezielteres Laden großer Datenpakete.

### Account & State
- Verbesserte Erkennung und Verwaltung des aktuell aktiven MSP2-Accounts.
- Saubereres Aktualisieren des lokalen Zustands beim Wechsel zwischen Accounts.
- Verbesserte lokale Zustandsverwaltung für Profile und Autogramm-Ziele.

Alle diese Erweiterungen bleiben lokal auf die Extension-Funktionalität beschränkt. Credential-Capture, Keylogging, Passwort-/Token-Speicherung, externe Vendor-Kommunikation, Remote-Gates, Heartbeat/Tracking und Feedback-Systeme wurden nicht übernommen.
