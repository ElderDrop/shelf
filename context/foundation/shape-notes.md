---
project: Shelf
context_type: greenfield
created: 2026-05-21
updated: 2026-05-21
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  quality_check_status: accepted
  gray_areas_resolved:
    - topic: pain category
      decision: workflow friction, missing capability, data trapped, decision paralysis
    - topic: insight
      decision: one app unifies owned collection + wishlist + sharing + light recommendations
    - topic: primary persona scope
      decision: solo collector (power user on own collection)
    - topic: access model
      decision: email + password login and registration
    - topic: roles
      decision: users assign from approved catalog; single admin curates catalog and approves items before they are visible
  frs_drafted: 8
  quality_check_status: pending
---

# Shape notes — Shelf

Seed: `docs/idea.md`

## Vision & Problem Statement

**Pain:** Kolekcjoner nie ma jednego miejsca, które łączy to, co fizycznie posiada (książki, mangi, komiksy i podobne), z wishlistą tego, czego chce, ale jeszcze nie ma. Trudno szybko odpowiedzieć na pytania „co już mam?” vs „co chcę kupić?” i utrzymać spójne metadane (tytuł, opis, tagi).

**Person:** Pojedynczy kolekcjoner — użytkownik budujący własną bibliotekę mediów fizycznych (solo, bez funkcji znajomych w MVP).

**Moment:** Przy dodawaniu nowej pozycji do biblioteki lub wishlisty, przy uzupełnianiu metadanych (ręcznie lub przez scrapowanie) oraz przy chęci pokazania kolekcji komuś przez link read-only.

**Cost today:** Rozproszone śledzenie (pamięć, notatki, arkusze), dużo ręcznej pracy przy metadanych, brak lekkich poleceń po tagach/opisie, brak wygodnego udostępniania biblioteki i wishlisty w jednym miejscu.

**Insight:** Status quo nie łączy w jednej aplikacji: posiadane pozycje + wishlista + udostępnianie (read-only) + rekomendacje po tagach lub opisie — przy obniżeniu bariery wejścia przez półautomatyczne dodawanie pozycji (częściowe scrapowanie).

## User & Persona

**Primary persona — solo kolekcjoner**

- **Name / role:** Kolekcjoner własnej biblioteki (książki, manga, komiksy i podobne).
- **Context:** Prowadzi prywatną kolekcję fizycznych egzemplarzy; część pozycji jest na wishliście.
- **Moment of need:** Chce szybko dodać pozycję, uzupełnić podstawowe dane, zobaczyć propozycje „co jeszcze pasuje” oraz udostępnić stan kolekcji bez edycji przez odbiorców linku.

## Access Control

- **Model:** Rejestracja i logowanie (e-mail + hasło).
- **Role użytkownika:** Zalogowany użytkownik przypisuje **zatwierdzone** pozycje z katalogu do własnej biblioteki lub wishlisty; nie tworzy ręcznie rekordów katalogu.
- **Rola admina (Ty):** Jedyny admin — ręczne wprowadzanie pozycji do katalogu, uruchamianie / nadzór nad automatyzacją (scrapowanie, tagi), **zatwierdzanie pozycji zanim staną się widoczne** dla użytkowników w katalogu.
- **Udostępnianie:** Link publiczny do biblioteki i wishlisty w trybie **tylko do odczytu** (bez edycji przez odbiorców linku).
- **Poza MVP (z idea.md):** znajomi, widoczność per osoba/grupa, obserwowanie cen — nie w pierwszej wersji.

## Success Criteria

### Primary

Użytkownik może przejść end-to-end przepływ MVP:

1. Zarejestrować się i zalogować (e-mail + hasło).
2. Wyszukać pozycję w katalogu (tylko pozycje zatwierdzone przez admina) i przypisać ją do biblioteki lub wishlisty.
3. (Ścieżka admina) Admin dodaje lub wzbogaca pozycję (ręcznie lub automatyzacja), zatwierdza ją — dopiero wtedy trafia do katalogu dla użytkowników.
4. Przeglądać własną bibliotekę i wishlistę (tytuł, opis, tagi).
5. Otrzymać polecenia innych pozycji na podstawie tagów lub opisu.
6. Wygenerować link i udostępnić bibliotekę oraz wishlistę w trybie read-only.
7. Odbiorca linku widzi bibliotekę i wishlistę bez możliwości edycji.

### Secondary

- Polecenia są sensowne przy małej kolekcji (np. ≥ 3 pozycje z tagami).
- Dodawanie pozycji z scrapowaniem jest szybsze niż wyłącznie ręczne wypełnianie wszystkich pól.

### Guardrails

- Link read-only nie pozwala na edycję ani usuwanie cudzej kolekcji.
- Dane jednego użytkownika nie są widoczne dla innego bez jawnego udostępnienia linkiem.
- Pozycje niezatwierdzone przez admina nie są widoczne w katalogu użytkownika.
- Automatyzacja (scrapowanie / tagi) jest audytowalna po stronie admina przed zatwierdzeniem.

## Functional Requirements

### Authentication

- FR-001: User can register and log in with email and password. Priority: must-have
  > Socrates: Counter-argument considered: "auth adds scope before catalog value." Resolution: kept; multi-user library and per-user assignment require accounts.

### Catalog & assignment

- FR-002: User can search the catalog and assign an approved item to their library or wishlist. Priority: must-have
  > Socrates: Counter-argument considered: "catalog is empty on start — user cannot assign until admin approves a batch." Resolution: kept; MVP accepts cold start; admin seeds initial approved catalog.
- FR-003: User can view their library and wishlist with title, description, and tags. Priority: must-have
  > Socrates: Counter-argument considered: "read-only views are trivial." Resolution: kept; core value is seeing owned vs wished items in one place.
- FR-004: Admin can manually create or edit catalog items (title, description, tags). Priority: must-have
  > Socrates: Counter-argument considered: "manual admin entry competes with full automation goal." Resolution: kept as fallback when automation fails or for edge cases.
- FR-005: Admin can run automated metadata enrichment (scraping, tag suggestions) on a catalog item and review the result before approval. Priority: must-have
  > Socrates: Counter-argument considered: "admin becomes bottleneck on every item." Resolution: kept; conscious trade-off — quality and control over throughput for MVP.
- FR-006: Admin can approve or reject catalog items so only approved items appear in the user-facing catalog. Priority: must-have
  > Socrates: Counter-argument considered: "users wait for admin — slower UX." Resolution: kept; user chose approval gate for catalog quality.

### Recommendations & sharing

- FR-007: User can receive item recommendations based on tags or description of items in their library. Priority: must-have
  > Socrates: Counter-argument considered: "building real recommendations is a separate product." Resolution: kept for MVP with **simple tag/description overlap**, not a custom recommendation engine.
- FR-008: User can generate a read-only share link that exposes their library and wishlist without edit rights. Priority: must-have
  > Socrates: Counter-argument considered: "public links leak collection privacy." Resolution: kept; link is opt-in; guardrail — no edit via link.

## User Stories

### US-01: User assigns an approved catalog item to their library

- **Given** a logged-in user and at least one admin-approved catalog item
- **When** they search the catalog and assign an item to their library
- **Then** the item appears in their library with title, description, and tags

#### Acceptance Criteria

- Unapproved catalog items do not appear in user search results
- The same item can be marked as library (owned) or wishlist per user assignment
- Assignment does not require manual catalog creation by the user

## Business Logic

**Reguła (jedno zdanie):** Aplikacja udostępnia użytkownikowi wyłącznie pozycje katalogu zatwierdzone przez admina oraz proponuje mu z tego samego katalogu pozycje najlepiej pasujące do tagów i opisu pozycji, które już ma w bibliotece.

**Wejścia (po stronie użytkownika):** Zawartość własnej biblioteki (tagi, opisy); wybór przypisania z katalogu; (po stronie admina) surowe źródło metadanych i decyzja zatwierdzenia.

**Wyjście:** Widoczny, zatwierdzony katalog; lista przypisań biblioteka/wishlist; ranking propozycji „co jeszcze pasuje” na podstawie prostego dopasowania tagów/opisu (bez własnego silnika ML).

**W produkcie:** Użytkownik wyszukuje i przypisuje tylko zatwierdzone pozycje; widzi rekomendacje; admin utrzymuje jakość katalogu przez automatyzację + ręczną korektę + zatwierdzenie.

## Non-Functional Requirements

- Biblioteka użytkownika nie jest publiczna domyślnie — dostęp dla innych tylko przez wygenerowany link read-only.
- Link read-only nie umożliwia edycji ani usuwania danych właściciela.
- (Użytkownik nie wskazał dodatkowych NFR na MVP poza powyższymi guardrails.)

## Non-Goals

- **Znajomi / social graph** — poza MVP; skupienie na solo kolekcjonowaniu i linku read-only.
- **Widoczność per osoba lub grupa** — brak granularnych uprawnień do pozycji w MVP.
- **Obserwowanie cen i dostępności** — świadomie odłożone.
- **Własny silnik rekomendacji (ML)** — w MVP wystarczy proste dopasowanie tagów/opisu.
- **Ręczne tworzenie pozycji katalogu przez zwykłego użytkownika** — tylko admin; użytkownik przypisuje z katalogu.
- **Offline-first** — aplikacja zakłada dostęp do sieci (katalog, logowanie, scrapowanie po stronie admina).

## Quality cross-check

Wszystkie elementy obecne na zakończenie sesji (2026-05-21).
