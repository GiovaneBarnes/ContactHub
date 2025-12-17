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
- **Comprehensive Test Suite**: Complete testing infrastructure with 100 tests covering:
  - **Frontend Tests**: React component testing with React Testing Library
  - **Firebase Integration**: Firebase configuration, API, and service initialization
  - **Firestore Rules**: Security rule validation and access control testing
  - **Utility Functions**: Input validation, sanitization, rate limiting, and security utilities
  - **Authentication Context**: Login, signup, logout, and auth state management
  - **Database Schema**: Zod validation for User and Group schemas
  - **UI Components**: Button component variants, sizes, and interactions
  - **Backend Configuration**: Security middleware, CORS, and rate limiting
- **Security Enhancements**: Production-ready security implementation including:
  - Helmet.js for comprehensive security headers (CSP, HSTS, XSS protection)
  - Express Rate Limiting with configurable limits and windows
  - CORS configuration with environment-based origin control
  - Input sanitization middleware for XSS prevention
  - Security utilities for email/phone validation and HTML escaping
  - Rate limiting for authentication attempts (login/signup protection)
- **Firebase Integration**: Complete Firebase backend setup and configuration including:
  - **Firebase Project Setup**: Full project initialization with Firestore, Hosting, and Authentication
  - **Firestore Database**: Real-time NoSQL database with comprehensive security rules
  - **Firebase Hosting**: Production-ready hosting configuration with SPA routing
  - **Firebase CLI Integration**: Local development tools and deployment pipeline
  - **Security Rules**: User-based access control for contacts, groups, and message logs
  - **Environment Configuration**: Secure environment variable management with .env.example template
  - **Firebase SDK Integration**: Client-side Firebase services (Firestore, Auth, Analytics)
  - **Comprehensive Testing**: 100 test suite covering Firebase integration, API, and configuration
  - **Production Security**: CSP headers, rate limiting, and Firebase-specific security measures

### Changed
- Updated Group interface to use `schedules` array instead of single `schedule`
- Enhanced mock data with realistic scheduling examples
- Improved group creation and editing workflows
- Modernized dashboard layout with improved Quick Actions formatting
- Enhanced user experience with comprehensive hover functionality and micro-interactions
- Default schedule start date now defaults to tomorrow instead of today to prevent accidental past scheduling
- Schedule form validation prevents selection of past dates
- Simplified schedule types from four types (one-time, recurring, holiday, special-day) to two types (one-time, recurring) with holiday support integrated into both
- Enhanced UI consistency across status indicators using custom styled elements instead of component library dependencies
- Improved user experience with proper cursor pointer display for all interactive elements throughout the application
- **Testing Infrastructure**: Migrated from no testing to comprehensive Vitest + React Testing Library setup
- **Security Configuration**: Added environment-based security settings with development/production modes

### Fixed
- **Badge Component Runtime Error**: Replaced Badge component imports with custom styled divs using consistent green/gray color schemes for status indicators
- **Schedule Status Display**: Updated schedule display logic to properly show disabled schedules with appropriate status indicators instead of misleading "No upcoming schedules" messages
- **Cursor Pointer Styling**: Added `cursor-pointer` to interactive CSS classes (`interactive-card`, `interactive-button`, `hover-scale`) to ensure all clickable elements show proper cursor feedback
- **Authentication Context Issues**: Fixed auth provider initialization and state management
- **Mobile Responsiveness**: Improved layout and navigation for mobile devices
- **TypeScript Compilation**: Resolved all TypeScript errors and strict mode compliance
- **Test Suite Issues**: Fixed all test configuration and syntax errors for clean test execution
- **Rate Limiting Configuration**: Increased rate limits from 100 to 1000 requests per 15 minutes in development and 500 in production to prevent false positives during normal usage
- **Content Security Policy (CSP)**: Updated CSP headers and HTML meta tags to allow Firebase API connections (Firestore, Auth, Analytics, Installations) in development mode
- **Vite Configuration**: Fixed JSX runtime to use automatic JSX transform and updated path aliases for Node.js compatibility
- **React Import Issues**: Fixed React import requirements in toast component for automatic JSX runtime
- **Server Error Handling**: Added comprehensive error handling and logging for server startup and request processing
- **Firebase Integration**: Resolved CSP violations preventing Firebase Firestore, Authentication, and Analytics from functioning properly
- **Firebase Test Suite**: Fixed all Firebase-related test failures including:
  - Firestore security rules test file path resolution
  - Firebase API mock setup for collection references and Timestamp handling
  - Firebase integration test measurement ID length validation
  - Firebase configuration test analytics initialization mocking

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