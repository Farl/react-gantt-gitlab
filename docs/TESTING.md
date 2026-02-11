# Testing Guide

## Overview

This project uses **Vitest** for unit and component testing. Vitest is a blazing-fast unit test framework powered by Vite, with first-class Vue and React support.

## Setup

Testing dependencies have been installed:

- **vitest**: Test framework
- **@testing-library/react**: React component testing utilities
- **@testing-library/jest-dom**: Jest-DOM matchers
- **@testing-library/user-event**: User interaction simulation
- **jsdom**: DOM implementation for Node.js
- **happy-dom**: Lightweight DOM implementation
- **@vitest/ui**: Interactive UI for test results

## Running Tests

### Development Mode (Watch)

```bash
npm test
```

Runs tests in watch mode. Tests re-run when files change.

### Interactive UI

```bash
npm run test:ui
```

Opens an interactive browser UI to view test results.

### Run Once (CI Mode)

```bash
npm run test:run
```

Runs tests once and exits. Useful for CI/CD pipelines.

### Coverage Report

```bash
npm run test:coverage
```

Generates test coverage report (text, JSON, HTML).

## File Structure

Test files should be placed in `__tests__` directories alongside the code they test:

```
src/
├── components/
│   ├── SyncButton.jsx
│   └── __tests__/
│       └── SyncButton.test.jsx
├── hooks/
│   ├── useDataSync.ts
│   └── __tests__/
│       └── useDataSync.test.ts
└── utils/
    ├── DataFilters.ts
    └── __tests__/
        └── DataFilters.test.ts
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
  });

  it('should do something', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = doSomething(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Testing Components

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should render button', () => {
    render(<MyComponent />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const onClick = vi.fn();
    render(<MyComponent onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react';
import { useMyHook } from '../useMyHook';

describe('useMyHook', () => {
  it('should return initial value', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.value).toBe('initial');
  });

  it('should update value', async () => {
    const { result } = renderHook(() => useMyHook());

    await act(async () => {
      result.current.setValue('new');
    });

    expect(result.current.value).toBe('new');
  });
});
```

### Mocking

```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('../api', () => ({
  fetchData: vi.fn(),
}));

// Mock a function
const mockFn = vi.fn().mockReturnValue('mocked');

// Mock async function
const mockAsync = vi.fn().mockResolvedValue({ data: 'test' });

// Clear mocks
mockFn.mockClear();
mockFn.mockReset();
mockFn.mockRestore();
```

## Configuration

### vitest.config.ts

Main configuration file for Vitest settings:

- `environment`: jsdom (browser-like environment)
- `globals`: Global test functions (describe, it, expect)
- `setupFiles`: Setup file (vitest.setup.ts)
- `coverage`: Coverage report settings

### vitest.setup.ts

Setup file that runs before all tests:

- Imports testing-library matchers
- Mocks window.matchMedia
- Mocks localStorage
- Mocks IntersectionObserver and ResizeObserver

## Best Practices

1. **Test Behavior, Not Implementation**: Test what the user sees, not how it works internally
2. **Use Semantic Queries**: Prefer `getByRole`, `getByLabelText` over `getByTestId`
3. **Async Operations**: Always use `waitFor` for async operations
4. **Mock External Dependencies**: Mock API calls, external services
5. **Clean Up**: Tests clean up automatically with afterEach
6. **Meaningful Names**: Use descriptive test names that explain what is being tested
7. **AAA Pattern**: Arrange, Act, Assert
8. **Keep Tests Simple**: One assertion per test when possible

## Common Testing Patterns

### Testing Data Filters

```typescript
it('should filter tasks by label', () => {
  const tasks = [
    { id: 1, labels: 'bug' },
    { id: 2, labels: 'feature' },
  ];

  const result = DataFilters.filterByLabels(tasks, ['bug']);

  expect(result).toHaveLength(1);
  expect(result[0].id).toBe(1);
});
```

### Testing Async Functions

```typescript
it('should fetch data', async () => {
  const mockProvider = {
    sync: vi.fn().mockResolvedValue({ tasks: [] }),
  };

  const { result } = renderHook(() => useDataSync(mockProvider));

  await act(async () => {
    await result.current.sync();
  });

  expect(mockProvider.sync).toHaveBeenCalled();
});
```

### Testing User Interactions

```typescript
it('should handle click', async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();

  render(<Button onClick={onClick}>Click me</Button>);

  await user.click(screen.getByRole('button'));

  expect(onClick).toHaveBeenCalled();
});
```

## Coverage Goals

- **Utilities**: 100% coverage (pure functions)
- **Hooks**: 80%+ coverage (logic-heavy)
- **Components**: 60%+ coverage (UI-heavy)
- **Integration**: Focus on critical user flows

Run coverage reports with:

```bash
npm run test:coverage
```

Coverage reports are generated in:

- Terminal: Text summary
- `coverage/` directory: HTML report (open `coverage/index.html` in browser)

## Debugging Tests

### Run Single Test File

```bash
npm test DataFilters
```

### Run Tests Matching Pattern

```bash
npm test -- --grep "filter"
```

### Enable Debug Logging

```typescript
import { screen, debug } from '@testing-library/react';

it('should render', () => {
  render(<MyComponent />);
  debug(); // Prints rendered DOM
});
```

## CI/CD Integration

In CI pipelines, use:

```bash
npm run test:run
```

This runs tests once with coverage reporting, ideal for:

- GitHub Actions
- GitLab CI
- Jenkins
- Other CI systems

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library React](https://testing-library.com/react)
- [Vitest UI](https://vitest.dev/guide/ui.html)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
