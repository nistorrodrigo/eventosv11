# LS Event Manager — Roadshow & Event Manager

## Overview
React + Vite SPA for managing investor roadshows, conferences, and events at Latin Securities. Deployed on Vercel with Supabase backend.

## Quick Start
```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # Production build
npx vitest run       # Run tests (18 passing)
```

## Tech Stack
- **Frontend**: React 18 + Vite 5 (JSX/TSX)
- **Backend**: Supabase (auth, Postgres, Realtime, Storage)
- **Deploy**: Vercel auto-deploy on push to `main`
- **Styling**: CSS-in-JS via styles.js with design system tokens
- **Validation**: Zod v4 schemas
- **Testing**: Vitest
- **Types**: TypeScript (gradual migration, `allowJs: true`)

## Architecture

### File Structure
```
App.jsx                          (~2887 lines) — main app shell, state, routing
main.jsx                         — entry point, providers, hash routing
supabase.js                      — Supabase client config
tsconfig.json                    — TypeScript config (gradual)

src/
  schemas.ts                     — Zod schemas + TypeScript types
  styles.js                      — Global CSS with design system tokens

  tabs/
    DashboardView.jsx            — Landing page, event cards, stats
    RoadshowInboundTab.jsx       — Inbound roadshow (most complex tab)
    RoadshowOutboundTab.jsx      — Outbound roadshow
    LibraryTab.jsx               — Global company/investor library

  components/
    BookingPage.jsx              — Public booking page (#/book/EVENT_ID)
    WeekCalendar.jsx             — Weekly calendar grid view
    Toast.jsx                    — Global toast notification system
    Skeleton.jsx                 — Shimmer loading placeholders
    EmptyState.jsx               — Illustrated empty states (6 SVG icons)
    FocusTrap.jsx                — Modal keyboard focus trap (a11y)
    TabErrorBoundary.jsx         — Error boundary per tab
    FeedbackWidget.jsx           — Meeting feedback form
    KioskModal.jsx               — Day mode / kiosk view
    RoadshowMeetingModal.jsx     — Meeting edit modal
    RoadshowEmailModal.jsx       — Email composition
    DatePicker.jsx               — Date input component
    CompanyModal.jsx / InvestorModal.jsx / MeetingModal.jsx

  contexts/
    AuthContext.jsx              — Auth state (signIn, signUp, signOut)
    EventContext.jsx             — Event/roadshow state (roadshow, saveRoadshow, etc.)

  utils/
    exporters.js                 — 5 export functions (Excel, PDF, driver itinerary, etc.)
    parsers.js                   — 6 file parsing functions (investor, company, meeting Excel)
    monitoring.js                — Web Vitals + error tracking

  travel.js                      — Geocoding, OSRM routing, CABA traffic model
  roadshow.jsx                   — ICS generation, email modals, booking page builder
  constants.jsx                  — Constants, scheduling algorithm, shared labels
  storage.jsx                    — localStorage persistence, HTML/Word export builders
```

### Design System (src/styles.js)
CSS variables defined in `:root`:
- **Colors**: `--c-navy`, `--c-blue`, `--c-success`, `--c-error`, `--c-text-muted`, etc.
- **Typography**: `--fs-xs` (9px) through `--fs-2xl` (32px), 3 font families
- **Spacing**: `--sp-1` (4px) through `--sp-10` (40px), 4pt grid
- **Radius**: `--r-sm`, `--r-md`, `--r-lg`, `--r-full`
- **Shadows**: `--shadow-sm` through `--shadow-overlay`
- **Z-index**: `--z-base` through `--z-toast`

Utility classes: `.text-xs`, `.text-muted`, `.bg-success`, `.p-4`, `.gap-2`, `.rounded-md`, etc.

### Supabase Tables
| Table | Purpose | RLS |
|-------|---------|-----|
| `ls_events` | Event data (JSON blob) | Owner read/write, shared read |
| `ls_global_db` | Company/investor library | Owner only |
| `roadshow_slots` | Published booking slots | Public read, owner write |
| `roadshow_bookings` | Booking requests | Public insert, owner read |
| `ls_event_shares` | Event sharing (viewer/editor) | Owner manage, recipient read |

### Contexts
- **AuthContext**: `useAuth()` — authUser, signIn, signUp, signOut, authLoading
- **EventContext**: `useEvent()` — roadshow, saveRoadshow, currentEvent, config, tripDays, rsCoById, travelCache, globalDB, saveGlobalDB

### Key Patterns
- **Lazy loading**: All tabs + xlsx via `React.lazy` + `Suspense`
- **Realtime sync**: Supabase postgres_changes subscription on `ls_events`
- **Toast notifications**: `toast()`, `toastOk()`, `toastErr()`, `toastWarn()` (global imperative API)
- **Error boundaries**: Each major tab wrapped in `TabErrorBoundary`
- **Push notifications**: Browser Notification API, 30 min before meetings
- **Design tokens**: CSS variables for all colors, typography, spacing

### Data Model (Roadshow)
```typescript
// See src/schemas.ts for Zod schemas and TypeScript types
interface Roadshow {
  trip: Trip;           // clientName, fund, hotel, dates, visitors
  meetings: Meeting[];  // date, hour, companyId, status, feedback
  companies: Company[]; // name, ticker, sector, contacts
  expenses: Expense[];  // date, category, amount, currency, receipt
  travelOverrides: Record<string, number>;
}
```

## Conventions
- **Language**: UI in Spanish, code comments in English
- **Commits**: `feat:`, `fix:`, `refactor:`, `perf:` prefixes
- **No default exports** (except lazy-loaded components)
- **Inline styles**: Being migrated to design system classes (ongoing)
- **Tests**: `src/__tests__/` directory, Vitest
- **TypeScript**: New files can be `.ts`/`.tsx`, existing `.js`/`.jsx` coexist
