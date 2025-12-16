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
- **Modern UI Enhancements**: Comprehensive interface modernization including:
  - Redesigned Quick Actions section with card-based layout and smooth animations
  - Interactive hover effects throughout the application (buttons, cards, navigation, tables)
  - Glassmorphism design for navigation sidebar with enhanced visual hierarchy
  - Modern gradients and animations for dashboard stats cards
  - Enhanced visual feedback for user interactions across all components
  - Improved accessibility with better contrast and hover states
- **Dark Mode Support**: Complete dark mode implementation with:
  - Theme toggle component with Light/Dark/System options
  - Seamless theme switching throughout the entire application
  - Dark mode optimized glassmorphism and gradient effects
  - Persistent theme preference using next-themes
  - Responsive theme toggle in both mobile header and desktop sidebar

### Changed
- Updated Group interface to use `schedules` array instead of single `schedule`
- Enhanced mock data with realistic scheduling examples
- Improved group creation and editing workflows
- Modernized dashboard layout with improved Quick Actions formatting
- Enhanced user experience with comprehensive hover functionality and micro-interactions
- Default schedule start date now defaults to tomorrow instead of today to prevent accidental past scheduling
- Schedule form validation prevents selection of past dates
- Simplified schedule types from four types (one-time, recurring, holiday, special-day) to two types (one-time, recurring) with holiday support integrated into both

### Fixed
- **Badge Component Runtime Error**: Replaced Badge component imports with custom styled divs using consistent green/gray color schemes for status indicators
- **Schedule Status Display**: Updated schedule display logic to properly show disabled schedules with appropriate status indicators instead of misleading "No upcoming schedules" messages
- **Cursor Pointer Styling**: Added `cursor-pointer` to interactive CSS classes (`interactive-card`, `interactive-button`, `hover-scale`) to ensure all clickable elements show proper cursor feedback

### Changed
- Enhanced UI consistency across status indicators using custom styled elements instead of component library dependencies
- Improved user experience with proper cursor pointer display for all interactive elements throughout the application
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