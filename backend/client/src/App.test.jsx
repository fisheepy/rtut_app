import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import axios from 'axios';
import App from './App';
import { menuItems } from './menuComponent';

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

beforeEach(() => {
  localStorage.clear();
  axios.get.mockResolvedValue({ data: [] });
  axios.post.mockResolvedValue({ data: [] });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

test('keeps the console hidden while checking the admin session', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  render(<App />);
  expect(screen.getByText('Checking admin session...')).toBeInTheDocument();
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

test('loads an authenticated console and renders every module after the React/MUI migration', async () => {
  const user = { firstName: 'Test', lastName: 'Admin', email: 'admin@example.test', type: 'admin' };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user }) }));
  render(<App />);
  expect(await screen.findByText('Test Admin')).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith('/api/admin-auth/me');
  for (const item of menuItems) {
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: new RegExp(`^${item.label}`) }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: item.label })).toBeInTheDocument());
  }
  expect(JSON.parse(localStorage.getItem('loginName'))).toEqual({ firstName: 'Test', lastName: 'Admin' });
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /^Employee Maintenance/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Add New Employee' }));
  const addDialog = await screen.findByRole('dialog', { name: 'Add New Employee' });
  expect(within(addDialog).getByRole('textbox', { name: /First Name/ })).toBeInTheDocument();
  expect(within(addDialog).getByRole('spinbutton', { name: /Pay Rate/ })).toHaveAttribute('min', '0.01');
  fireEvent.click(within(addDialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Terminate Employee' }));
  const terminateDialog = await screen.findByRole('dialog', { name: 'Terminate Employee' });
  expect(within(terminateDialog).getByRole('combobox', { name: /Employee to Terminate/ })).toBeInTheDocument();
});
