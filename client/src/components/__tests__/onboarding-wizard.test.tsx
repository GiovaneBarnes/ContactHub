import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnboardingWizard } from '../onboarding-wizard';
import { firebaseApi } from '@/lib/firebase-api';

// Mock the auth context
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    isAuthenticated: true,
  }),
}));

// Mock firebase API
vi.mock('@/lib/firebase-api', () => ({
  firebaseApi: {
    contacts: {
      create: vi.fn().mockResolvedValue({ id: 'contact-1' }),
      import: vi.fn().mockResolvedValue([{ id: 'contact-1' }]),
    },
    groups: {
      create: vi.fn().mockResolvedValue({ id: 'group-1' }),
      list: vi.fn().mockResolvedValue([]),
      createSchedule: vi.fn().mockResolvedValue({ id: 'schedule-1' }),
    },
    smartGroups: {
      suggestGroups: vi.fn().mockResolvedValue({
        insights: 'Test insights',
        suggestedGroups: [{
          name: 'Test Group',
          purpose: 'Test purpose',
          contactCount: 1,
          rationale: 'Test rationale'
        }]
      }),
    },
    ai: {
      generateMessage: vi.fn().mockResolvedValue('Generated message'),
    },
    schedules: {
      create: vi.fn().mockResolvedValue({ id: 'schedule-1' }),
    },
  },
}));

// Mock metrics service
vi.mock('@/lib/metrics', () => ({
  metricsService: {
    trackEvent: vi.fn(),
    trackFeatureUsage: vi.fn(),
  },
}));

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('OnboardingWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step 1 by default when open', () => {
    renderWithQueryClient(<OnboardingWizard open={true} onComplete={() => {}} />);

    expect(screen.getByText('Welcome to ContactHub! 🎉')).toBeInTheDocument();
    expect(screen.getByText('Let\'s get started by adding your first contact. You can import from CSV or create manually.')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    renderWithQueryClient(<OnboardingWizard open={false} onComplete={() => {}} />);

    expect(screen.queryByText('Welcome to ContactHub!')).not.toBeInTheDocument();
  });

  it('navigates through steps correctly', async () => {
    renderWithQueryClient(<OnboardingWizard open={true} onComplete={() => {}} />);

    // Start with step 1
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();

    // Select manual contact creation by clicking the card
    fireEvent.click(screen.getByText('Create Manually'));

    // Fill out step 1 - manual contact creation
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '123-456-7890' } });

    // Click continue
    const continueButton = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
      expect(screen.getByText('Create Your First Group 👥')).toBeInTheDocument();
    });
  });

  it('allows going back to previous steps', async () => {
    renderWithQueryClient(<OnboardingWizard open={true} onComplete={() => {}} />);

    // Select manual contact creation and fill form
    fireEvent.click(screen.getByText('Create Manually'));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '123-456-7890' } });

    // Go to step 2
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    });

    // Go back to step 1
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    });
  });

  it('shows progress indicators', () => {
    renderWithQueryClient(<OnboardingWizard open={true} onComplete={() => {}} />);

    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();

    // Progress bar should be visible
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('completes onboarding and calls onComplete', async () => {
    const onComplete = vi.fn();
    const mockCreateContact = vi.fn().mockResolvedValue({ id: 'contact-1' });
    const mockCreateGroup = vi.fn().mockResolvedValue({ id: 'group-1' });
    const mockGenerateMessage = vi.fn().mockResolvedValue('Generated message');
    const mockCreateSchedule = vi.fn().mockResolvedValue({ id: 'schedule-1' });

    // Mock the API calls
    const { firebaseApi } = await import('@/lib/firebase-api');
    vi.mocked(firebaseApi.contacts.create).mockImplementation(mockCreateContact);
    vi.mocked(firebaseApi.groups.create).mockImplementation(mockCreateGroup);
    vi.mocked(firebaseApi.ai.generateMessage).mockImplementation(mockGenerateMessage);
    vi.mocked(firebaseApi.schedules.create).mockImplementation(mockCreateSchedule);

    renderWithQueryClient(<OnboardingWizard open={true} onComplete={onComplete} />);

    // Step 1: Select manual creation and create contact
    fireEvent.click(screen.getByText('Create Manually'));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '123-456-7890' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Step 2: Create group
    await waitFor(() => screen.getByText('Step 2 of 4'));
    fireEvent.change(screen.getByLabelText(/group name/i), { target: { value: 'Friends' } });
    fireEvent.click(screen.getByRole('button', { name: /create group/i }));

    // Step 3: Generate message
    await waitFor(() => screen.getByText('Step 3 of 4'));
    fireEvent.click(screen.getByRole('button', { name: /generate ai message/i }));
    await waitFor(() => screen.getByText('Message Generated Successfully!'));
    
    // Click continue to go to step 4
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Step 4: Schedule
    await waitFor(() => screen.getByText('Step 4 of 4'));
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2025-12-25' } });
    fireEvent.change(screen.getByLabelText(/time/i), { target: { value: '10:00' } });

    // Complete
    const completeButton = screen.getByRole('button', { name: /complete setup/i });
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('handles manual contact creation validation', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<OnboardingWizard open={true} onComplete={() => {}} />);

    // Select manual entry
    const manualButton = screen.getByText('Create Manually');
    await user.click(manualButton);

    // Try to continue without filling fields
    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeDisabled();

    // Fill in name only
    const nameInput = screen.getByLabelText(/name/i);
    await user.type(nameInput, 'John Doe');
    expect(continueButton).toBeDisabled();

    // Fill in email
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'john@example.com');
    expect(continueButton).toBeDisabled();

    // Fill in phone - now button should be enabled
    const phoneInput = screen.getByLabelText(/phone/i);
    await user.type(phoneInput, '+1234567890');
    expect(continueButton).not.toBeDisabled();
  });

  it('allows adding notes to manual contact', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<OnboardingWizard open={true} onComplete={() => {}} />);

    // Select manual entry
    const manualButton = screen.getByText('Create Manually');
    await user.click(manualButton);

    // Find and type in notes
    const notesTextarea = screen.getByLabelText(/notes/i);
    await user.type(notesTextarea, 'Important client contact');
    expect(notesTextarea).toHaveValue('Important client contact');
  });

  it('handles skip button on first step', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<OnboardingWizard open={true} onComplete={() => {}} />);

    const skipButton = screen.getByText('Skip for now');
    await user.click(skipButton);

    // Should move to next step
    await waitFor(() => {
      expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    });
  });

  it('handles manual contact creation validation', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<OnboardingWizard open={true} onComplete={() => {}} />);

    // Select manual entry
    const manualButton = screen.getByText('Create Manually');
    await user.click(manualButton);

    // Try to continue without filling fields
    const continueButton = screen.getByRole('button', { name: /continue/i });
    expect(continueButton).toBeDisabled();

    // Fill in name only
    const nameInput = screen.getByLabelText(/name/i);
    await user.type(nameInput, 'John Doe');
    expect(continueButton).toBeDisabled();

    // Fill in email
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'john@example.com');
    expect(continueButton).toBeDisabled();

    // Fill in phone - now button should be enabled
    const phoneInput = screen.getByLabelText(/phone/i);
    await user.type(phoneInput, '+1234567890');
    expect(continueButton).not.toBeDisabled();
  });

  it('allows adding notes to manual contact', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<OnboardingWizard open={true} onComplete={() => {}} />);

    // Select manual entry
    const manualButton = screen.getByText('Create Manually');
    await user.click(manualButton);

    // Find and type in notes
    const notesTextarea = screen.getByLabelText(/notes/i);
    await user.type(notesTextarea, 'Important client contact');
    expect(notesTextarea).toHaveValue('Important client contact');
  });

  it('handles skip button on first step', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<OnboardingWizard open={true} onComplete={() => {}} />);

    const skipButton = screen.getByText('Skip for now');
    await user.click(skipButton);

    // Should move to next step
    await waitFor(() => {
      expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    });
  });

  it.skip('handles contact import functionality', async () => {
    renderWithQueryClient(<OnboardingWizard open={true} onComplete={() => {}} />);

    // Select CSV import
    await act(async () => {
      fireEvent.click(screen.getByText('Import CSV'));
    });

    // Wait for import UI to appear
    await waitFor(() => screen.getByLabelText(/click to upload csv file/i));

    // Upload file - get the actual input element
    const actualInput = document.getElementById('file-upload') as HTMLInputElement;
    const csvContent = 'name,email,phone\nJohn Doe,john@example.com,123-456-7890';
    const file = new File([csvContent], 'contacts.csv', { type: 'text/csv' });
    
    // Trigger file change using userEvent
    const user = userEvent.setup();
    await user.upload(actualInput, file);

    // Wait for file to be displayed
    await waitFor(() => {
      expect(screen.getByText('contacts.csv')).toBeInTheDocument();
    });

    // Click import/continue button
    const importButton = screen.getByRole('button', { name: /continue/i });
    expect(importButton).not.toBeDisabled();
    
    await act(async () => {
      fireEvent.click(importButton);
    });

    // Wait for the API to be called (the mutation loops through contacts)
    await waitFor(() => {
      expect(firebaseApi.contacts.create).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        notes: '',
      });
    }, { timeout: 5000 });
  });

  it('shows smart group suggestions', async () => {
    const mockSuggestGroups = vi.fn().mockResolvedValue({
      suggestedGroups: [
        { name: 'Work Colleagues', purpose: 'Professional networking' },
        { name: 'Family', purpose: 'Personal relationships' },
      ],
      insights: 'Based on your contacts, here are some suggested groups.',
    });
    const { firebaseApi } = await import('@/lib/firebase-api');
    vi.mocked(firebaseApi.smartGroups.suggestGroups).mockImplementation(mockSuggestGroups);

    renderWithQueryClient(<OnboardingWizard open={true} onComplete={() => {}} />);

    // Go to step 2 - first create a contact
    fireEvent.click(screen.getByText('Create Manually'));
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/phone/i), { target: { value: '123-456-7890' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => screen.getByText('Step 2 of 4'));

    // Enable smart suggestions
    const smartSuggestionsButton = screen.getByRole('button', { name: /get ai suggestions/i });
    fireEvent.click(smartSuggestionsButton);

    await waitFor(() => {
      expect(mockSuggestGroups).toHaveBeenCalled();
    });
  });

  it('can be skipped at any step', () => {
    renderWithQueryClient(<OnboardingWizard open={true} onComplete={() => {}} />);

    // Should start on step 1
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();

    // Click skip to go to step 2
    const skipButton = screen.getByRole('button', { name: /skip for now/i });
    fireEvent.click(skipButton);

    // Should now be on step 2
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
  });
});