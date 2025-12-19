import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ThemeToggle } from '../theme-toggle';

// Mock next-themes
const mockSetTheme = vi.fn();
vi.mock('next-themes', () => ({
  useTheme: () => ({
    setTheme: mockSetTheme,
    theme: 'light',
  }),
}));

// Mock Radix UI dropdown to always show content for testing
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} role="menuitem">{children}</button>
  ),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
  });

  it('renders the theme toggle button', () => {
    render(<ThemeToggle />);

    const button = screen.getByRole('button', { name: /toggle theme/i });
    expect(button).toBeInTheDocument();
  });

  it('calls setTheme when theme options are clicked', () => {
    render(<ThemeToggle />);

    // With mocked dropdown, menu items are always visible
    const lightOption = screen.getByRole('menuitem', { name: /light/i });
    fireEvent.click(lightOption);
    expect(mockSetTheme).toHaveBeenCalledWith('light');

    const darkOption = screen.getByRole('menuitem', { name: /dark/i });
    fireEvent.click(darkOption);
    expect(mockSetTheme).toHaveBeenCalledWith('dark');

    const systemOption = screen.getByRole('menuitem', { name: /system/i });
    fireEvent.click(systemOption);
    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });
});