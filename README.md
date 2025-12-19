# ContactHub 📱

A modern, AI-powered contact management application built with Firebase, React, and cutting-edge AI capabilities. Manage your contacts, organize them into groups, and communicate intelligently with AI-generated messages.

![ContactHub](https://img.shields.io/badge/ContactHub-1.2.0-blue?style=for-the-badge)
![Firebase](https://img.shields.io/badge/Firebase-Enabled-orange?style=flat-square)
![AI Powered](https://img.shields.io/badge/AI-Powered-purple?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=flat-square)

## ✨ Features

### 🤖 AI-Powered Features
- **Smart Message Generation**: AI-crafted messages tailored to your groups and relationships
- **Intelligent Contact Categorization**: Automatic tagging and categorization of new contacts
- **Communication Insights**: AI-driven analysis of contact patterns and preferences with detailed insights drawer
- **Personalized Scheduling**: Smart suggestions for optimal contact timing
- **AI Feature Indicators**: Visual badges and guided tours for AI-powered functionality

### 📊 Advanced Analytics & Metrics
- **Comprehensive User Tracking**: Detailed analytics on user behavior, feature usage, and engagement
- **AI Performance Monitoring**: Track AI feature usage, success rates, and response times
- **Predictive Analytics**: Machine learning-powered predictions for user churn, engagement, and feature adoption
- **Real-time Dashboards**: Beautiful analytics dashboard with insights and trends
- **Custom Event Tracking**: Extensible metrics system for all user interactions

### 📊 Contact Management
- **Full CRUD Operations**: Create, read, update, and delete contacts with ease
- **Advanced Group Management**: Organize contacts into groups with custom schedules
- **Bulk Operations**: Import/export contacts, bulk delete, and batch operations
- **Rich Contact Profiles**: Store emails, phone numbers, notes, and custom fields
- **Contact Insights**: AI-powered analysis drawer showing communication patterns, optimal contact times, and relationship insights

### 📅 Scheduling System
- **Flexible Scheduling**: One-time and recurring schedules with custom intervals
- **Group Messaging**: Send messages to entire groups with scheduling
- **Schedule Management**: View upcoming schedules and manage delivery times
- **Calendar Integration**: Visual schedule overview with conflict detection

### 🎯 User Onboarding & Experience
- **Interactive Onboarding Wizard**: 3-step guided experience for new users covering contact creation, AI messaging, and scheduling
- **Quick Start Guide**: Re-triggerable onboarding for existing users and feature refresher
- **Progressive Disclosure**: Show features as users need them with contextual guidance
- **Empty State Solutions**: Immediate value delivery to prevent user intimidation

### 🔐 Security & Privacy
- **Firebase Authentication**: Secure user authentication with email/password
- **Data Encryption**: All data encrypted in transit and at rest
- **Access Control**: User-based data isolation and security rules
- **CSP Protection**: Content Security Policy for enhanced security
- **Logging Security**: All console logging disabled for production privacy

### 🎨 Modern UI/UX
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Dark Mode**: Complete dark/light theme support with system preference detection
- **Glassmorphism**: Modern UI with beautiful glass effects and animations
- **Accessibility**: WCAG compliant with screen reader support

### 📈 Analytics & Insights
- **User Behavior Tracking**: Comprehensive analytics on feature usage and engagement
- **AI Performance Metrics**: Monitor AI feature effectiveness and usage patterns
- **Predictive Modeling**: ML-powered insights for user retention and feature adoption
- **Real-time Dashboards**: Visual analytics with trends and predictions
- **Privacy-First**: All analytics data is user-controlled and secure

## 🚀 Tech Stack

### Frontend
- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Beautiful, accessible component library
- **TanStack Query** - Powerful data fetching and caching
- **React Router** - Client-side routing

### Backend & Infrastructure
- **Firebase** - Complete backend-as-a-service platform
  - **Firestore** - Real-time NoSQL database
  - **Firebase Auth** - User authentication
  - **Firebase Functions** - Serverless backend with AI
  - **Firebase Hosting** - Global CDN hosting
- **Firebase Genkit** - AI development framework
- **Google Gemini AI** - Advanced AI models for messaging and analysis

### Development & Testing
- **Vitest** - Fast unit testing framework
- **React Testing Library** - Component testing utilities
- **Firebase Emulators** - Local development environment
- **ESLint + Prettier** - Code quality and formatting

## 🛠️ Getting Started

### Prerequisites

- **Node.js 18+** - Required for modern JavaScript features
- **Firebase CLI** - For Firebase services and deployment
- **Git** - Version control

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/GiovaneBarnes/ContactHub.git
   cd ContactHub
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install Firebase CLI:**
   ```bash
   npm install -g firebase-tools
   ```

4. **Set up Firebase project:**
   ```bash
   # Login to Firebase
   firebase login

   # Initialize or connect to Firebase project
   firebase use --add
   # Select your Firebase project (contacthub-29950)
   ```

5. **Configure environment:**
   ```bash
   # Copy environment template
   cp .env.example .env

   # Edit .env with your Firebase config (already populated for contacthub-29950)
   ```

### Development

1. **Start Firebase emulators:**
   ```bash
   npm run emulators
   ```
   This starts local Firebase services (Auth, Firestore, Functions, Hosting)

2. **Start development server:**
   ```bash
   npm run dev
   ```
   Opens at `http://localhost:5001` (Firebase Hosting emulator)

3. **View emulator UI:**
   Visit `http://localhost:4000` to inspect data and debug

### Production

**🌐 Live Application:**
- **Primary**: [https://contact-hub.net](https://contact-hub.net) (custom domain - may take 24-48 hours)
- **Immediate Access**: [https://contacthub-net.web.app](https://contacthub-net.web.app) (available now)

The application is deployed on Firebase Hosting with custom domain configuration. The production build serves the same features as development but with optimized performance and security.

**Firebase Project:** `contacthub-29950`
**Custom Domain:** `contact-hub.net`

### Available Scripts

```bash
# Development
npm run dev              # Start Vite dev server
npm run emulators        # Start Firebase emulators
npm run dev:client       # Start client only (requires emulators running)

# Building
npm run build            # Build for production
npm run build:client     # Build client only
npm run build:functions  # Build Firebase functions

# Testing
npm test                 # Run test suite
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Run tests with UI

# Firebase
npm run firebase:deploy  # Deploy to Firebase
npm run firebase:serve   # Serve locally with Firebase

# Database
npm run db:generate      # Generate Drizzle migrations (legacy)
npm run db:push          # Push schema changes (legacy)

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format with Prettier
npm run type-check       # TypeScript type checking
```

## 📁 Project Structure

```
├── client/                 # React frontend application
│   ├── public/            # Static assets
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities and configurations
│   │   ├── pages/         # Page components
│   │   └── test/          # Test utilities
├── functions/             # Firebase Cloud Functions
│   ├── src/              # Function source code
│   └── lib/              # Compiled functions
├── shared/               # Shared types and schemas
├── firestore.rules       # Firestore security rules
├── firebase.json         # Firebase configuration
└── .firebaserc          # Firebase project configuration
```

## 🔧 Configuration

### Firebase Setup

The project is configured for Firebase project `contacthub-29950` with custom domain `contact-hub.net`.

**Current Configuration:**
- **Firebase Project ID:** `contacthub-29950`
- **Primary Domain:** `https://contact-hub.net`
- **Firebase Hosting Site:** `contact-hub-net`
- **Functions Region:** `us-central1`

To use your own project:

1. Create a new Firebase project at https://console.firebase.google.com/
2. Enable Authentication, Firestore, Functions, and Hosting
3. Update `.firebaserc` and `.env` with your project details
4. Deploy security rules: `firebase deploy --only firestore:rules`

### Environment Variables

Key environment variables (see `.env.example`):

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Admin Configuration
VITE_ADMIN_EMAILS=admin@example.com,another-admin@example.com

# Legacy (can be removed)
DATABASE_URL=postgresql://...
```

## 🚀 Deployment

### Firebase Deployment

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Deploy to Firebase:**
   ```bash
   firebase deploy
   ```

This deploys:
- Hosting (client app)
- Functions (AI backend)
- Firestore rules

### Environment Deployment

The app works on any static hosting platform:

- **Firebase Hosting** (recommended)
- **Vercel**
- **Netlify**
- **GitHub Pages**

## 🤖 AI Features

ContactHub uses Firebase Genkit with Google Gemini AI for:

- **Message Generation**: Context-aware group messages
- **Contact Categorization**: Automatic tagging and organization
- **Communication Analysis**: Insights into contact patterns
- **Smart Scheduling**: AI-suggested optimal contact times

## 🧪 Testing

Run the comprehensive test suite:

```bash
npm test
```

Tests cover:
- Component functionality
- Firebase integration
- Authentication flows
- API operations
- Security rules
- AI features

## 🔒 Security

- **Firebase Security Rules**: Database access control
- **Content Security Policy**: XSS protection
- **Rate Limiting**: API abuse prevention
- **Input Sanitization**: XSS prevention
- **Authentication Required**: All data operations

## 📱 Mobile Support

ContactHub is fully responsive and works on:
- 📱 Mobile phones
- 📱 Tablets
- 💻 Desktops
- 💻 Laptops

## 📊 Analytics Dashboard

ContactHub includes a comprehensive **administrator analytics system** accessible at `/analytics` (admin access required):

### 🎯 **Purpose: Product Optimization & Business Intelligence**

The analytics dashboard is designed for **administrators and developers** to:
- Understand user behavior patterns and feature adoption
- Monitor system performance and identify bottlenecks
- Make data-driven decisions for product improvements
- Predict user engagement and retention trends
- Optimize feature development based on usage data

### 🔒 **Access Control**
- Analytics dashboard is **hidden from regular users**
- Only accessible to administrators configured via `VITE_ADMIN_EMAILS` environment variable
- Supports multiple admin emails (comma-separated list)
- User data is **isolated** - users cannot see others' analytics
- All data collection is **transparent and privacy-focused**

### 📊 **Key Metrics Tracked:**
- **User Engagement**: Login frequency, session duration, feature usage
- **Contact Management**: Creation, updates, deletions, and import activities
- **Messaging**: Message sending, scheduling, and delivery tracking
- **AI Usage**: Feature adoption, success rates, and performance metrics
- **System Performance**: Page load times, API response times, error rates

### 🤖 **Predictive Analytics:**
- **Churn Risk Assessment**: Identify users likely to stop using the app
- **Engagement Scoring**: Measure user activity and satisfaction levels
- **Feature Adoption**: Predict which users will adopt new features
- **Growth Forecasting**: Estimate future user growth and engagement trends

### 🛡️ **Privacy & Security:**
- All analytics data is stored securely in Firestore
- Users can only access their own analytics data (when permitted)
- Data is used solely for improving user experience
- No personal information is shared with third parties
- GDPR-compliant data handling practices

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the **Apache License 2.0**, chosen for its patent protection provisions that help safeguard both contributors and users from patent litigation. The Apache License provides:

- **Patent Protection**: Explicit patent grant and retaliation clauses protect against patent trolls
- **Commercial Friendly**: Allows commercial use, modification, and distribution
- **Copyleft Balance**: Modified versions can be proprietary, but modifications must be disclosed
- **Compatibility**: Compatible with GPL v3 and many other open source licenses

See the [LICENSE](LICENSE) file for the complete license text.

## 🙏 Acknowledgments

- **Firebase** for the amazing backend-as-a-service platform
- **Google Gemini AI** for powering intelligent features
- **shadcn/ui** for beautiful, accessible components
- **Vite** for the incredible developer experience
- **Tailwind CSS** for utility-first styling

---

**Built with ❤️ using Firebase, React, and AI**

