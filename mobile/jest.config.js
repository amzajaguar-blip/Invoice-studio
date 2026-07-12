module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((react-native|@react-native|expo|expo-.*|@expo/.*|i18n-js|react-native-.*|@react-navigation/.*|react-native-safe-area-context)/))',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
