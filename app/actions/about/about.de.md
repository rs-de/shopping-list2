Kürzlich machte ich Besorgungen für meine Familie und als ich im Supermarkt ankam, öffnete ich eine andere Einkaufslisten-App, und erhielt die Fehlermeldung "Keine Artikel gefunden".
Ich weiß nicht warum, aber aus irgendeinem Grund hat mich die App ausgeloggt, und ich konnte mich nicht wieder einloggen. Ohne meinen "Einkaufszettel" war ich verloren. Es waren sehr viele Artikel auf der Liste und da meine Frau die Artikel aufschrieb, wusste ich nicht, was ich kaufen sollte!
Lange Rede, kurzer Sinn, der Einkauf war ein einziges Chaos, und an diesem Tag wurde viel Zeit verschwendet.

### Warum muss ich mich anmelden, um eine Einkaufsliste zu erstellen?

Solange wir unsere Einkäufe selbst erledigen, erstellen viele von uns Einkaufslisten auf Papier.
Da **es sich nur um ein Stück Papier handelt**, kann jeder darauf Artikel hinzufügen/entfernen/ändern, und wir müssen uns bei dem Stück Papier auch nicht anmelden :-).
Es liegt auf der Hand, dass wir unser Smartphone für einen solchen Anwendungsfall nutzen können.
Da ich ein Webanwendungsentwickler bin, habe ich beschlossen, eine App mit folgenden Anforderungen zu erstellen:

- Keine Anmeldung/Registrierung erforderlich
- Keine persönlichen Daten erforderlich
- Kein Tracking
- Keine Werbung
- Keine Cookies
- Kostenlos zu benutzen
- Offener Quelltext
- So einfach wie möglich
- Einfach zu benutzen
- Plattformübergreifend (Web, Handy, Desktop)
- Mehrsprachig (derzeit Deutsch und Englisch)

### Wie funktioniert es?

#### Zugang zu einer Liste

Um eine Einkaufsliste nur der Person zugänglich zu machen, die sie erstellt hat, wird eine weltweit eindeutige Kennung verwendet, um die Liste zu identifizieren.
Eine solche Kennung sieht wie folgt aus: 14d77b4e62117ad749890c6d. Da es so extrem viele mögliche Kombinationen gibt, ist es praktisch unmöglich, eine gültige Kennung zu erraten. Und selbst wenn ein Fremder sie kennt, was für Daten wird er erhalten? Nur eine Liste mit einigen Artikeln ... na und?

#### Erstellung einer Liste

Um eine mögliche Überflutung der Datenbank mit neuen Listen zu vermeiden, ist die Erstellung einer Liste zeitlich begrenzt.
Wir können nur eine Liste innerhalb von 5 Sekunden erstellen.Das gilt für alle Benutzer. Dies ist zwar nicht skalierbar, aber für den Moment reicht es.

#### Andere Benutzerdaten

Da die Listen-ID die einzigen Daten sind, die wir benötigen, um eine Liste zu identifizieren, werden keine weiteren Daten vom Benutzer benötigt.
Die App setzt keine Cookies und benötigt keine Daten vom User Agent (Ihrem Gerät oder Browser).

#### Quellcode der App

Der Quellcode der App ist öffentlich zugänglich auf github, verlinkt zu finden ganz unten in Fußzeile dieser Seite.

### Was ich hoffe

- Jeder der mag kann sie einfach ohne Probleme nutzen.
- Es wird nicht von Bots oder anderem missbraucht.
- Es gibt genug freie Zeit, um die App zu pflegen.

### Warum habe ich die Schaltfläche "Buy me a coffee" hinzugefügt?

Ich habe in meiner Karriere so viel Open Source verwendet, und bei einigen Projekten, die ich verwendet hatte, wollte ich irgendwann "etwas zurückgeben", was ich über solche Funktionen tun konnte. Warum also nicht auch hier anbieten?
(Siehe mein Blog: [Danke, Open Source](https://www.rushsoft.de/blog/thank-you-open-source) ).
Wenn Ihnen die Anwendung gefällt und Sie helfen möchten, können Sie das damit tun!
