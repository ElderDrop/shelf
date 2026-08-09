---
project: Shelf
version: 1
status: draft
created: 2026-05-21
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

# Shelf — Product Requirements Document

## Vision & Problem Statement

Kolekcjoner mediów fizycznych (książki, manga, komiksy i podobne) nie ma jednego miejsca, które łączy to, co już posiada, z wishlistą tego, czego chce kupić. Przy dodawaniu pozycji, uzupełnianiu metadanych i chęci pokazania kolekcji komuś traci czas na rozproszone śledzenie (pamięć, notatki, arkusze), ręczną pracę przy tytule, opisie i tagach oraz na brak lekkich poleceń i wygodnego udostępniania biblioteki i wishlisty w jednym miejscu.

Status quo nie łączy w jednej aplikacji posiadanych pozycji, wishlisty, udostępniania read-only i rekomendacji po tagach lub opisie. Shelf zakłada obniżenie bariery wejścia przez kuratorowany katalog (zatwierdzany przez admina) oraz półautomatyczne wzbogacanie metadanych przed udostępnieniem pozycji użytkownikom.

## User & Persona

### Primary persona — solo kolekcjoner

- **Role:** Kolekcjoner własnej biblioteki (książki, manga, komiksy i podobne).
- **Context:** Prowadzi prywatną kolekcję fizycznych egzemplarzy; część pozycji jest na wishliście. MVP bez funkcji znajomych.
- **Moment of need:** Chce szybko przypisać pozycję z katalogu, zobaczyć propozycje „co jeszcze pasuje” oraz udostępnić stan kolekcji bez edycji przez odbiorców linku.

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
- Dodawanie pozycji z automatycznym wzbogacaniem metadanych jest szybsze niż wyłącznie ręczne wypełnianie wszystkich pól po stronie admina.

### Guardrails

- Link read-only nie pozwala na edycję ani usuwanie cudzej kolekcji.
- Dane jednego użytkownika nie są widoczne dla innego bez jawnego udostępnienia linkiem.
- Pozycje niezatwierdzone przez admina nie są widoczne w katalogu użytkownika.
- Automatyzacja wzbogacania metadanych jest audytowalna po stronie admina przed zatwierdzeniem.

## User Stories

### US-01: User assigns an approved catalog item to their library

- **Given** a logged-in user and at least one admin-approved catalog item
- **When** they search the catalog and assign an item to their library
- **Then** the item appears in their library with title, description, and tags

#### Acceptance Criteria

- Unapproved catalog items do not appear in user search results
- The same item can be marked as library (owned) or wishlist per user assignment
- Assignment does not require manual catalog creation by the user

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

## Non-Functional Requirements

- Biblioteka użytkownika nie jest publiczna domyślnie — dostęp dla innych tylko przez wygenerowany link read-only.
- Link read-only nie umożliwia edycji ani usuwania danych właściciela.

## Business Logic

Aplikacja udostępnia użytkownikowi wyłącznie pozycje katalogu zatwierdzone przez admina oraz proponuje mu z tego samego katalogu pozycje najlepiej pasujące do tagów i opisu pozycji, które już ma w bibliotece.

**Wejścia (po stronie użytkownika):** Zawartość własnej biblioteki (tagi, opisy); wybór przypisania z katalogu; (po stronie admina) surowe źródło metadanych i decyzja zatwierdzenia.

**Wyjście:** Widoczny, zatwierdzony katalog; lista przypisań biblioteka/wishlist; ranking propozycji „co jeszcze pasuje” na podstawie prostego dopasowania tagów/opisu (bez własnego silnika rekomendacji).

**W produkcie:** Użytkownik wyszukuje i przypisuje tylko zatwierdzone pozycje; widzi rekomendacje; admin utrzymuje jakość katalogu przez automatyzację + ręczną korektę + zatwierdzenie.

## Access Control

- **Model:** Rejestracja i logowanie (e-mail + hasło).
- **Role użytkownika:** Zalogowany użytkownik przypisuje **zatwierdzone** pozycje z katalogu do własnej biblioteki lub wishlisty; nie tworzy ręcznie rekordów katalogu.
- **Rola admina:** Jedyny admin — ręczne wprowadzanie pozycji do katalogu, uruchamianie / nadzór nad automatyzacją wzbogacania metadanych (w tym pobieranie metadanych z zewnętrznych źródeł, sugestie tagów), **zatwierdzanie pozycji zanim staną się widoczne** dla użytkowników w katalogu.
- **Udostępnianie:** Link publiczny do biblioteki i wishlisty w trybie **tylko do odczytu** (bez edycji przez odbiorców linku).
- **Poza MVP:** znajomi, widoczność per osoba/grupa, obserwowanie cen — nie w pierwszej wersji.

## Non-Goals

- **Znajomi / social graph** — poza MVP; skupienie na solo kolekcjonowaniu i linku read-only.
- **Widoczność per osoba lub grupa** — brak granularnych uprawnień do pozycji w MVP.
- **Obserwowanie cen i dostępności** — świadomie odłożone.
- **Własny silnik rekomendacji** — w MVP wystarczy proste dopasowanie tagów/opisu.
- **Ręczne tworzenie pozycji katalogu przez zwykłego użytkownika** — tylko admin; użytkownik przypisuje z katalogu.
- **Offline-first** — aplikacja zakłada dostęp do sieci (katalog, logowanie, wzbogacanie metadanych po stronie admina).

## Open Questions

1. **Wymierne progi NFR wydajności** — Owner: product owner. Brak konkretnych progów (np. czas wyszukiwania katalogu) w notatkach shape; do ustalenia przed implementacją, jeśli potrzebne.
