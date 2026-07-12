import React, { useEffect } from 'react';
import { Text, Button } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocaleProvider, useLocale } from '../components/LocaleProvider';

const TestComponent = () => {
  const { locale, setLocale, t } = useLocale();
  return (
    <>
      <Text testID="locale">{locale}</Text>
      <Text testID="dashboard">{t('dashboard')}</Text>
      <Button title="Switch to English" onPress={() => setLocale('en')} />
    </>
  );
};

describe('LocaleProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads default locale', async () => {
    const { getByTestId } = render(
      <LocaleProvider>
        <TestComponent />
      </LocaleProvider>
    );

    await waitFor(() => {
      expect(getByTestId('locale').children[0]).toBe('it');
    });
  });

  it('changes locale and persists to AsyncStorage', async () => {
    const { getByTestId, getByText } = render(
      <LocaleProvider>
        <TestComponent />
      </LocaleProvider>
    );

    await waitFor(() => {
      expect(getByTestId('locale').children[0]).toBe('it');
    });

    fireEvent.press(getByText('Switch to English'));

    await waitFor(() => {
      expect(getByTestId('locale').children[0]).toBe('en');
      expect(getByTestId('dashboard').children[0]).toBe('Dashboard');
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('app_locale', 'en');
  });

  it('throws for unsupported locale', async () => {
    const InvalidComponent = () => {
      const { setLocale } = useLocale();
      return <Button title="Invalid" onPress={() => setLocale('xx' as any)} />;
    };

    const { getByText } = render(
      <LocaleProvider>
        <InvalidComponent />
      </LocaleProvider>
    );

    expect(() => fireEvent.press(getByText('Invalid'))).toThrow();
  });
});
