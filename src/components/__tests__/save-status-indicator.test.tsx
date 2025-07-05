import { render, screen } from '@testing-library/react';
import { SaveStatusIndicator } from '../save-status-indicator';

describe('SaveStatusIndicator', () => {
  it('should show saving status', () => {
    render(<SaveStatusIndicator status="saving" />);

    expect(screen.getByText('Saving...')).toBeInTheDocument();
    // Check for spinner (Loader2 icon)
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should show saved status with last saved time', () => {
    const lastSaved = new Date();
    render(<SaveStatusIndicator status="saved" lastSaved={lastSaved} />);

    expect(screen.getByText(/Saved/)).toBeInTheDocument();
    // Check for checkmark icon
    const savedIcon = screen.getByRole('img', { hidden: true });
    expect(savedIcon).toBeInTheDocument();
  });

  it('should show error status with error message', () => {
    const errorMessage = 'Failed to save changes';
    render(<SaveStatusIndicator status="error" error={errorMessage} />);

    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    // Check for error icon
    const errorIcon = screen.getByRole('img', { hidden: true });
    expect(errorIcon).toBeInTheDocument();
  });

  it('should show offline status', () => {
    render(<SaveStatusIndicator status="offline" />);

    expect(screen.getByText('Offline')).toBeInTheDocument();
    // Check for cloud off icon
    const offlineIcon = screen.getByRole('img', { hidden: true });
    expect(offlineIcon).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<SaveStatusIndicator status="saved" className="custom-class" />);

    const indicator = container.firstChild;
    expect(indicator).toHaveClass('custom-class');
  });

  it('should not render when status is null', () => {
    const { container } = render(<SaveStatusIndicator status={null as any} />);
    expect(container.firstChild).toBeNull();
  });
});
