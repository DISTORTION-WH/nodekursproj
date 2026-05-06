/**
 * Component tests for AuthForm (login mode).
 * Uses React Testing Library; mocks AuthContext, i18n, and router.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockLogin = jest.fn();
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

jest.mock('../i18n', () => ({
  useI18n: () => ({
    t: {
      auth: {
        welcome_back: 'Welcome back',
        welcome: 'Create account',
        username: 'Username',
        password: 'Password',
        forgot_password: 'Forgot password?',
        login_button: 'Log in',
        register_button: 'Register',
        login_error: 'Invalid credentials',
      },
    },
  }),
}));

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: () => jest.fn(),
}));

jest.mock('../components/ForgotPasswordModal', () => () => <div data-testid="forgot-modal" />);

import AuthForm from '../components/AuthForm';

function renderLogin() {
  return render(<AuthForm type="login" />);
}

beforeEach(() => {
  mockLogin.mockReset();
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('AuthForm (login) rendering', () => {
  it('renders the LUME logo text', () => {
    renderLogin();
    expect(screen.getByText('LUME')).toBeInTheDocument();
  });

  it('renders username input', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('username')).toBeInTheDocument();
  });

  it('renders password input with type=password', () => {
    renderLogin();
    const pwInput = screen.getByPlaceholderText('••••••••');
    expect(pwInput).toBeInTheDocument();
    expect(pwInput).toHaveAttribute('type', 'password');
  });

  it('renders "Forgot password?" button', () => {
    renderLogin();
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('does not show error message by default', () => {
    renderLogin();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ─── Submit validation ────────────────────────────────────────────────────────

describe('AuthForm (login) submit behavior', () => {
  it('calls login with username and password', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText('username'), 'alice');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pass1234');
    fireEvent.submit(screen.getByRole('button', { name: /log in/i }).closest('form')!);

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('alice', 'pass1234'));
  });

  it('does not call login when username is empty', async () => {
    renderLogin();
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pass1234');
    fireEvent.submit(screen.getByRole('button', { name: /log in/i }).closest('form')!);
    await waitFor(() => expect(mockLogin).not.toHaveBeenCalled());
  });

  it('does not call login when password is empty', async () => {
    renderLogin();
    await userEvent.type(screen.getByPlaceholderText('username'), 'alice');
    fireEvent.submit(screen.getByRole('button', { name: /log in/i }).closest('form')!);
    await waitFor(() => expect(mockLogin).not.toHaveBeenCalled());
  });

  it('does not call login when both fields are whitespace', async () => {
    renderLogin();
    await userEvent.type(screen.getByPlaceholderText('username'), '   ');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), '   ');
    fireEvent.submit(screen.getByRole('button', { name: /log in/i }).closest('form')!);
    await waitFor(() => expect(mockLogin).not.toHaveBeenCalled());
  });

  it('shows error message when login throws', async () => {
    mockLogin.mockRejectedValue(new Error('Неверные данные'));
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText('username'), 'alice');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'wrong');
    fireEvent.submit(screen.getByRole('button', { name: /log in/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Неверные данные')).toBeInTheDocument();
    });
  });

  it('shows fallback error when login throws without message', async () => {
    mockLogin.mockRejectedValue({});
    renderLogin();

    await userEvent.type(screen.getByPlaceholderText('username'), 'alice');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'pass');
    fireEvent.submit(screen.getByRole('button', { name: /log in/i }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});

// ─── Forgot password modal ────────────────────────────────────────────────────

describe('AuthForm forgot password modal', () => {
  it('shows forgot-modal when "Forgot password?" is clicked', async () => {
    renderLogin();
    await userEvent.click(screen.getByText('Forgot password?'));
    expect(screen.getByTestId('forgot-modal')).toBeInTheDocument();
  });
});

// ─── Register mode ────────────────────────────────────────────────────────────

describe('AuthForm (register) rendering', () => {
  it('renders welcome text for register mode', () => {
    render(<AuthForm type="register" />);
    expect(screen.getByText('Create account')).toBeInTheDocument();
  });
});
