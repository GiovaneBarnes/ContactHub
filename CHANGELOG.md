# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Advanced Scheduling System**: Complete overhaul of group scheduling with support for:
  - One-time schedules
  - Recurring schedules (daily, weekly, monthly, yearly)
  - Custom intervals (every 2 weeks, every 3 months, etc.)
  - Specific days of week/month
  - Holiday and special day scheduling
  - Schedule exceptions and enable/disable functionality
- **ScheduleManager Component**: Full-featured UI for creating and managing group schedules
- **UpcomingSchedules Component**: Dashboard widget showing next scheduled contacts
- **Schedule Utilities**: Comprehensive date calculation logic for all schedule types
- **Enhanced Group Management**: Groups now support multiple schedules with rich configuration

### Changed
- Updated Group interface to use `schedules` array instead of single `schedule`
- Enhanced mock data with realistic scheduling examples
- Improved group creation and editing workflows

### Technical Improvements
- New `Schedule` interface with flexible frequency configuration
- `getNextOccurrences()` function for calculating upcoming schedule dates
- `formatSchedule()` utility for human-readable schedule descriptions
- Type-safe schedule management throughout the application

## [1.0.0] - 2025-12-12

### Added
- Initial release of ContactHub - Phone Contact App
- User authentication (login/signup)
- Contact management (CRUD operations)
- Group management with contact associations
- Message logging system
- AI-powered message generation
- Responsive UI with shadcn/ui components
- Full-stack architecture with React + Express + PostgreSQL

### Infrastructure
- Vite for frontend build tooling
- TypeScript for type safety
- Drizzle ORM for database operations
- TanStack Query for state management
- Tailwind CSS for styling