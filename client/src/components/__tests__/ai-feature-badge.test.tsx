import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { AIFeatureBadge } from '../ai-feature-badge';

// Mock the tooltip components
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('AIFeatureBadge', () => {
  it('renders with default props', () => {
    render(<AIFeatureBadge data-testid="badge" />);

    const badgeContainer = screen.getByTestId('badge');
    expect(badgeContainer).toBeInTheDocument();
    expect(badgeContainer).toHaveClass('inline-flex', 'items-center', 'justify-center', 'rounded-full');
    expect(badgeContainer).toHaveClass('bg-purple-100', 'dark:bg-purple-950', 'text-purple-600', 'dark:text-purple-400');
  });

  it('renders with custom tooltip', () => {
    render(<AIFeatureBadge tooltip="Custom AI tooltip" />);

    expect(screen.getByText('Custom AI tooltip')).toBeInTheDocument();
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<AIFeatureBadge size="sm" data-testid="badge" />);
    let badgeContainer = screen.getByTestId('badge');
    expect(badgeContainer.querySelector('svg')).toHaveClass('h-4', 'w-4');

    rerender(<AIFeatureBadge size="md" data-testid="badge" />);
    badgeContainer = screen.getByTestId('badge');
    expect(badgeContainer.querySelector('svg')).toHaveClass('h-5', 'w-5');

    rerender(<AIFeatureBadge size="lg" data-testid="badge" />);
    badgeContainer = screen.getByTestId('badge');
    expect(badgeContainer.querySelector('svg')).toHaveClass('h-6', 'w-6');
  });

  it('applies pulse animation when pulse is true', () => {
    render(<AIFeatureBadge pulse={true} data-testid="badge" />);

    const badgeContainer = screen.getByTestId('badge');
    expect(badgeContainer).toHaveClass('animate-pulse');
  });

  it('applies custom className', () => {
    render(<AIFeatureBadge className="custom-class" data-testid="badge" />);

    const badgeContainer = screen.getByTestId('badge');
    expect(badgeContainer).toHaveClass('custom-class');
  });

  it('renders without tooltip when tooltip is empty', () => {
    render(<AIFeatureBadge tooltip="" data-testid="badge" />);

    const badgeContainer = screen.getByTestId('badge');
    expect(badgeContainer).toBeInTheDocument();
    // Should not render tooltip content
    expect(screen.queryByText('AI-Powered Feature')).not.toBeInTheDocument();
  });
});