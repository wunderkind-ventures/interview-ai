import { render, screen, act } from '@testing-library/react';
import { SessionTimer } from '../session-timer';

// Mock the formatMilliseconds utility
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  formatMilliseconds: (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  },
}));

describe('SessionTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should not render when startTime is not provided', () => {
    const { container } = render(<SessionTimer />);
    expect(container.firstChild).toBeNull();
  });

  it('should display elapsed time from Date object', () => {
    const startTime = new Date(Date.now() - 5000); // 5 seconds ago
    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText(/Session Time:/)).toBeInTheDocument();
    expect(screen.getByText(/5s/)).toBeInTheDocument();
  });

  it('should display elapsed time from timestamp number', () => {
    const startTime = Date.now() - 10000; // 10 seconds ago
    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText(/Session Time:/)).toBeInTheDocument();
    expect(screen.getByText(/10s/)).toBeInTheDocument();
  });

  it('should update timer every second', () => {
    const startTime = Date.now();
    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText(/0s/)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/1s/)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/2s/)).toBeInTheDocument();
  });

  it('should stop updating when paused', () => {
    const startTime = Date.now() - 5000; // 5 seconds ago
    const { rerender } = render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText(/5s/)).toBeInTheDocument();

    // Pause the timer
    rerender(<SessionTimer startTime={startTime} isPaused={true} />);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    // Should still show 5s (not updated)
    expect(screen.getByText(/5s/)).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const startTime = Date.now();
    const { container } = render(<SessionTimer startTime={startTime} className="custom-timer" />);

    const timerDiv = container.firstChild;
    expect(timerDiv).toHaveClass('custom-timer');
  });

  it('should display minutes and seconds correctly', () => {
    const startTime = Date.now() - 125000; // 2 minutes and 5 seconds ago
    render(<SessionTimer startTime={startTime} />);

    expect(screen.getByText(/2m 5s/)).toBeInTheDocument();
  });

  it('should clean up interval on unmount', () => {
    const startTime = Date.now();
    const { unmount } = render(<SessionTimer startTime={startTime} />);

    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
