# Wordle Tournament Tracker

A full-stack React Native mobile application for tracking daily Wordle scores and competing in tournaments with friends.

## Features

### Daily Submissions
- Submit your Wordle results once per day
- Automatic score calculation based on number of guesses
- Countdown timer showing time until 11 PM EST cutoff
- Visual display of submitted Wordle grid
- Scores automatically applied to all active tournaments

### Tournaments
- Create and manage tournaments with join codes
- Join tournaments using unique 6-character codes
- Maximum 15 players per tournament
- Maximum 4 tournaments per user
- Draft, active, and closed tournament states
- Tournament creators can edit/manage draft tournaments
- Once started, tournaments are locked and automated

### Scoring System
- 1 guess: 20 points
- 2 guesses: 8 points
- 3 guesses: 6 points
- 4 guesses: 4 points
- 5 guesses: 2 points
- 6 guesses: 1 point
- No submission: -2 points (penalty)

### Tournament Management
- Create new tournaments with custom date ranges
- Edit tournament details while in draft status
- Add/remove participants before starting
- Start tournament to lock it for competition
- Delete tournaments that haven't started

### Leaderboards & Results
- Real-time tournament leaderboards
- View yesterday's submissions from all participants
- See Wordle grids from other players
- Results hidden until all players submit or 11 PM EST cutoff
- Forfeit option for users who want to leave tournaments

### Statistics
- Average score (excluding penalties)
- Total submissions count
- Tournament wins
- Total tournaments participated
- Best and worst scores

### Account Management
- Update display name
- View account information
- Sign out functionality

## Technology Stack

### Frontend
- **React Native** with Expo (SDK 54)
- **Expo Router** for file-based navigation
- **TypeScript** for type safety
- **Lucide React Native** for icons
- **React Native Web** for web compatibility

### Backend
- **Supabase** for database and authentication
- **PostgreSQL** database
- **Row Level Security (RLS)** policies
- **SQL triggers** for automatic score updates

### Authentication
- Email/password authentication via Supabase Auth
- Secure token storage with expo-secure-store
- Session management with auto-refresh

## Database Schema

### Tables

#### users
- `id` - UUID primary key (links to auth.users)
- `display_name` - User's display name
- `created_at` - Account creation timestamp

#### tournaments
- `id` - UUID primary key
- `name` - Tournament name
- `join_code` - Unique 6-character code
- `start_date` - Tournament start date
- `end_date` - Tournament end date
- `status` - 'draft', 'active', or 'closed'
- `created_by` - Foreign key to users
- `created_at` - Creation timestamp

#### tournament_participants
- `id` - UUID primary key
- `tournament_id` - Foreign key to tournaments
- `user_id` - Foreign key to users
- `forfeited` - Boolean flag for forfeits
- `joined_at` - Join timestamp

#### daily_submissions
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `submission_date` - Date of submission (EST)
- `submission_text` - Full Wordle share output
- `wordle_score` - Calculated score
- `submitted_at` - Submission timestamp
- UNIQUE constraint on (user_id, submission_date)

#### tournament_scores
- `id` - UUID primary key
- `tournament_id` - Foreign key to tournaments
- `user_id` - Foreign key to users
- `total_score` - Sum of all daily scores
- `last_updated` - Last update timestamp

## Business Rules

1. **Tournament Limits**
   - Maximum 15 players per tournament
   - Maximum 4 tournaments per user (active/draft combined)
   - Users can only join tournaments via join code

2. **Tournament States**
   - **Draft**: Creator can edit, add/remove players, delete tournament
   - **Active**: Locked, no edits allowed, scoring in progress
   - **Closed**: Tournament ended, final scores displayed

3. **Daily Submissions**
   - One submission per user per day
   - Submission window: 12:00 AM - 11:00 PM EST
   - No resubmissions allowed
   - Full trust model - no validation of Wordle content
   - Submissions apply to ALL active tournaments user has joined

4. **Penalties**
   - -2 points assigned at 11 PM EST cutoff if no submission
   - Applied via daily cron job
   - Cannot be avoided once assigned

5. **Results Visibility**
   - Daily results hidden until either:
     - All tournament participants have submitted
     - 11 PM EST cutoff passes
   - Shows "Waiting for today's submissions" when not ready

6. **Forfeits**
   - Users can forfeit (leave) active tournaments
   - Forfeited players show as "Forfeited" on leaderboard
   - Cannot rejoin after forfeiting
   - No further scoring after forfeit

## Cron Job

A daily cron job must run at 11:00 PM EST to:
1. Apply -2 point penalties to users who haven't submitted
2. Recalculate all tournament scores
3. Close tournaments that have reached their end date

See `CRON_JOB_LOGIC.md` for the complete SQL implementation.

## Development Setup

### Prerequisites
- Node.js 18+ and npm
- Expo CLI
- Supabase account and project

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies
```bash
npm install
```

3. Configure environment variables
The `.env` file is already set up with Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=<your-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-key>
```

4. Google Play review login

The app signs in with **email and password** (not “Sign in with Google”).

- Local + linked remote provisioning can be done via seeded SQL:
  - set `SUPABASE_PLAY_REVIEW_PASSWORD` in `.env` (optional but recommended)
  - run `npm run supabase:db:push` for linked remote (this now includes seed data)
  - run `npm run supabase:db:reset` for local reset
- The seed script is idempotent and will create or update the Play review account/profile each time.

For manual hosted setup (Dashboard-driven), if you create the auth user directly in Supabase Auth, ensure profile row exists:

`INSERT INTO public.users (id, display_name) SELECT id, 'Google Play Review' FROM auth.users WHERE email = '<reviewer-email>' ON CONFLICT (id) DO NOTHING;`

5. Run database migrations
The migrations are already applied. Tables include:
- users
- tournaments
- tournament_participants
- daily_submissions
- tournament_scores

### Running the App

#### Web (Development)
```bash
npm run dev
```

#### Build for Web
```bash
npm run build:web
```

#### iOS/Android (Development Build Required)
```bash
npx expo run:ios
npx expo run:android
```

## Expo Development

This project uses Expo's managed workflow. To export for further development in Cursor or other editors:

1. The project is already structured for Expo development
2. All native dependencies are Expo-compatible
3. Can be opened directly in Cursor/VS Code
4. Development builds can be created with EAS:
```bash
npx eas build --platform ios
npx eas build --platform android
```

## File Structure

```
/app
  /(auth)           - Authentication screens (login, signup)
  /(tabs)           - Main app tabs (submission, tournaments, stats, account)
  /tournament/[id]  - Tournament detail page
  /manage-tournaments - Tournament management
/contexts
  /AuthContext.tsx  - Authentication context and state
/lib
  /supabase.ts      - Supabase client configuration
/types
  /database.types.ts - TypeScript database types
```

## Security

- Row Level Security (RLS) enabled on all tables
- Authentication required for all data access
- Users can only access their own data and tournaments they've joined
- Tournament creators have special permissions only in draft mode
- Secure token storage using expo-secure-store
- No API keys or secrets exposed in client code

## Future Enhancements

- Push notifications for daily reminders
- Tournament chat functionality
- Weekly/monthly tournaments
- Custom scoring systems
- Friend system
- Profile avatars
- Dark mode
- Email notifications
- Social sharing

## Support

For issues or questions, please refer to:
- Expo documentation: https://docs.expo.dev
- Supabase documentation: https://supabase.com/docs
- React Native documentation: https://reactnative.dev
- Privacy policy for app store listing: `docs/privacy-policy.md`

## License

MIT
